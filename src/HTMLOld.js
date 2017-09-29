import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View } from 'react-native';
import htmlparser2 from 'htmlparser2';
import HTMLElement from './HTMLElement';
import HTMLTextNode from './HTMLTextNode';
import * as HTMLRenderers from './HTMLRenderers';
import { blockElements } from './HTMLStyles';
import { TEXT_TAG_NAMES } from './HTMLUtils';

const BLOCK_TAGS = ['address', 'article', 'aside', 'footer', 'hgroup', 'nav', 'section', 'blockquote', 'dd', 'div',
    'dl', 'dt', 'figure', 'hr', 'li', 'main', 'ol', 'ul', 'a', 'br', 'cite', 'data', 'rp', 'rtc', 'ruby', 'area',
    'img', 'map', 'center'];

const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figcaption', 'p', 'pre', 'abbr', 'b', 'bdi', 'bdo', 'code',
    'dfn', 'i', 'kbd', 'mark', 'q', 'rt', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
    'del', 'ins', 'blink', 'font'];

const IGNORED_TAGS = ['head', 'scripts', 'audio', 'video', 'track', 'embed', 'object', 'param', 'source', 'canvas', 'noscript',
    'caption', 'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'button', 'datalist', 'fieldset', 'form',
    'input', 'label', 'legend', 'meter', 'optgroup', 'option', 'output', 'progress', 'select', 'textarea', 'details', 'diaglog',
    'menu', 'menuitem', 'summary'];

export default class HTML extends PureComponent {

    static propTypes = {
        renderers: PropTypes.object.isRequired,
        ignoredTags: PropTypes.array.isRequired,
        ignoredStyles: PropTypes.array.isRequired,
        ignoreNodesFunction: PropTypes.func,
        html: PropTypes.string,
        uri: PropTypes.string,
        tagsStyles: PropTypes.object,
        classesStyles: PropTypes.object,
        containerStyle: View.propTypes.style,
        onLinkPress: PropTypes.func,
        imagesMaxWidth: PropTypes.number,
        emSize: PropTypes.number.isRequired
    }

    static defaultProps = {
        renderers: HTMLRenderers,
        emSize: 14,
        ignoredTags: IGNORED_TAGS,
        ignoredStyles: [],
        tagsStyles: {},
        classesStyles: {}
    }

    constructor (props) {
        super(props);
        this.state = {};
        this.renderers = {
            ...HTMLRenderers,
            ...(this.props.renderers || {})
        };
        this.imgsToRender = [];
    }

    componentWillMount () {
        this.registerIgnoredTags();
        this.registerDOM();
    }

    componentWillReceiveProps (nextProps) {
        if (this.props.html !== nextProps.html || this.props.uri !== nextProps.uri) {
            this.imgsToRender = [];
            this.registerDOM(nextProps);
        }
        if (this.props.ignoredTags !== nextProps.ignoredTags) {
            this.registerIgnoredTags(nextProps);
        }
        if (this.props.renderers !== nextProps.renderers) {
            this.renderers = { ...HTMLRenderers, ...(nextProps.renderers || {}) };
        }
    }

    async registerDOM (props = this.props) {
        const { html, uri } = props;
        if (html) {
            this.setState({ dom: props.html });
        } else if (props.uri) {
            try {
                // WIP : This should render a loader and html prop should not be set in state
                // Error handling would be nice, too.
                let response = await fetch(uri);
                this.setState({ dom: response._bodyText });
            } catch (err) {
                console.warn('react-native-render-html', `Couldn't fetch remote HTML from uri : ${uri}`);
                return false;
            }
        } else {
            console.warn('react-native-render-html', 'Please provide the html or uri prop.');
        }
    }

    registerIgnoredTags (props = this.props) {
        this._ignoredTags = props.ignoredTags.map((tag) => tag.toLowerCase());
    }

    /**
     * Returns an RN element from the HTML node being parsed
     * @param node: object
     * @param index: number
     * @param groupInfo: object
     * @param parentTagName: string
     * @parentIsText: bool
     */
    createElement (node, index, groupInfo, parentTagName, parentIsText) {
        const { tagsStyles, classesStyles, imagesMaxWidth, onLinkPress, emSize, ignoredStyles } = this.props;
        return (
            <HTMLElement
              key={index}
              tagsStyles={tagsStyles}
              classesStyles={classesStyles}
              imagesMaxWidth={imagesMaxWidth}
              htmlAttribs={node.attribs}
              tagName={node.name}
              groupInfo={groupInfo}
              parentTagName={parentTagName}
              parentIsText={parentIsText}
              onLinkPress={onLinkPress}
              renderers={this.renderers}
              emSize={emSize}
              ignoredStyles={ignoredStyles}>
                { this.renderHtmlAsRN(node.children, node.name, !blockElements.has(node.name), node.attribs, node.name) }
            </HTMLElement>
        );
    }

  /**
   * Returns if a text node is worth being rendered.
   * Loop on it and its children and look for actual text to display,
   * if none is found, don't render it (a single img or an empty p for instance)
   */
    shouldRenderNode (node) {
        const textType = TEXT_TAG_NAMES.has(node.type);
        const hasChildren = node.children.filter((node) => node !== undefined && node !== false).length;

        if (textType && !hasChildren) {
            return false;
        }
        return true;
    }

    /**
    * Converts the html elements to RN elements
    * @param htmlElements: the array of html elements
    * @param parentTagName='body': the parent html element if any
    * @param parentIsText: true if the parent element was a text-y element
    * @return the equivalent RN elements
    */
    renderHtmlAsRN (htmlElements, parentTagName, parentIsText, htmlAttribs, tagName) {
        const { ignoreNodesFunction } = this.props;
        return htmlElements.map((node, index, list) => {
            if (ignoreNodesFunction && ignoreNodesFunction(node, parentTagName, parentIsText) === true) {
                return false;
            }
            if (this._ignoredTags.indexOf(node.name) !== -1) {
                return false;
            }
            if (node.type === 'text') {
                const str = HTMLTextNode.removeWhitespaceListHTML(node.data, index, parentTagName);
                if (str.length) {
                    return (
                        <HTMLTextNode
                          key={index}
                          htmlAttribs={htmlAttribs}
                          tagName={tagName}
                        >
                            {str}
                        </HTMLTextNode>
                    );
                } else {
                    return false;
                }
            } else if (node.type === 'tag') {
                // Generate grouping info if we are a group-type element
                let groupInfo;
                if (node.name === 'li') {
                    groupInfo = {
                        index: htmlElements.reduce((acc, e) => {
                            if (e === node) {
                                acc.found = true;
                            } else if (!acc.found && e.type === 'tag' && e.name === 'li') {
                                acc.index++;
                            }
                            return acc;
                        },
                        { index: 0, found: false }).index,
                        count: htmlElements.filter((e) => e.type === 'tag' && e.name === 'li').length
                    };
                }

                let ElementsToRender;
                const Element = this.createElement(node, index, groupInfo, parentTagName, parentIsText);

                if (this.imgsToRender.length && !parentIsText) {
                    ElementsToRender = (
                        <View key={index}>
                            { this.imgsToRender.map((img, imgIndex) => <View key={`view-${index}-image-${imgIndex}`}>{ img }</View>) }
                            { Element }
                        </View>
                    );
                    this.imgsToRender = [];
                } else {
                    ElementsToRender = Element;
                }

                if (node.name === 'img' && parentIsText && parentTagName !== 'a') {
                    this.imgsToRender.push({ ...Element, firstLoopIndex: index });
                    return false;
                }

                if (TEXT_TAG_NAMES.has(node.name)) {
                    if (!this.shouldRenderNode(node)) {
                        return false;
                    }
                }

                return ElementsToRender;
            }
        })
        .filter((e) => e !== undefined);
    }

    mapDOMNodesTORNElements (DOMNodes) {
        return DOMNodes.map((node) => {
            const { type, attribs, name, data } = node;
            let { children } = node;
            // Remove whitespaces to check if it's just a blank text
            const strippedData = data && data.replace(/\s/g, '');
            if (type === 'text') {
                if (!strippedData || !strippedData.length) {
                    // This is blank, don't render an useless additional component
                    return false;
                }
                // Text without tags or line breaks, this can be mapped to the Text
                // component without any modification
                return { Component: 'Text', data, attribs, tagName: name || 'rawtext' };
            }
            if (type === 'tag') {
                if (children) {
                    // Recursively map all children with this method
                    children = this.mapDOMNodesTORNElements(children);
                }
                if (this.childrenNeedAView(children) || BLOCK_TAGS.indexOf(name.toLowerCase()) !== -1) {
                    // If children cannot be nested in a Text, or if the tag
                    // maps to a block element, use a view
                    return { Component: 'View', children, attribs, tagName: name };
                } else if (TEXT_TAGS.indexOf(name.toLowerCase()) !== -1) {
                    // We are able to nest its children inside a Text
                    return { Component: 'Text', children, attribs, tagName: name };
                }
                return { Component: 'View', children, attribs, tagName: name };
            }
        })
        .filter((parsedNode) => parsedNode !== false) // remove useless nodes
        .map((parsedNode) => {
            const { Component, children, attribs, tagName } = parsedNode;
            const firstChild = children && children[0];
            if (firstChild && children.length === 1 && firstChild.Component === Component) {
                // If the only child of a node is using the same component, merge them into one
                return {
                    ...parsedNode,
                    attribs: { ...attribs, ...firstChild.attribs },
                    data: firstChild.data,
                    children: [],
                    tagName
                };
            }
            return parsedNode;
        });
    }

    childrenNeedAView (children) {
        children.forEach((child) => {
            if (child.Component === 'View') {
                // If we find at least one View, it has to be nested in one
                return true;
            }
        });
        // We didn't find a single view, it can be wrapped in a Text
        return false;
    }

    render () {
        const { dom } = this.state;
        if (!dom) {
            return false;
        }
        let rnNodes;
        const parser = new htmlparser2.Parser(
            new htmlparser2.DomHandler((_err, dom) => {
                // rnNodes = this.renderHtmlAsRN(dom, 'body', false);
                console.log('DOMNodes', dom);
                console.log('Parsed nodes', this.mapDOMNodesTORNElements(dom));
            })
        );
        parser.write(dom);
        parser.done();

        return (
            <View style={this.props.containerStyle || {}}>{rnNodes}</View>
        );
    }
}
