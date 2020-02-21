const React = require('react');

const { Clipboard, Dimensions, Easing, Animated, View, Text, FlatList, TouchableNativeFeedback, Keyboard, StyleSheet } = require('react-native');

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { KeyboardAvoidingView } from 'react-native';

// const { connect } = require('react-redux');
// const { _ } = require('lib/locale.js');

const styles = StyleSheet.create({
    toolbarView: {
        backgroundColor: 'rgb(236, 239, 241)',
        height: 40,
        flexDirection: 'row',
        alignItems: 'center'
    },
    toolbarBox: {
        backgroundColor: 'rgb(236, 239, 241)',
        flexDirection: 'row',
        alignItems: 'center'
    },
    toolbarBoxItem: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        fontSize: 35,
        width: 35,
        height: 35,
        marginLeft: 5,
        marginRight: 5,
    },
    undo: {
        fontSize: 40,
        width: 50,
        height: 40,
        backgroundColor: "rgb(0, 128, 239)"
    },
    arrow: {
        height: 40,
        fontSize: 40,
        backgroundColor: "rgb(0, 128, 239)"
    },
});

class MarkdwonToolbarComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            scrollEndFlag: false,
            toolbarBoxDisplay: false,
            toolbarBoxAnimHeight: new Animated.Value(0),
            KeyboardHeight: 300,
        }
        // NOTE focus protect for toolbarBox | typically when focus to title input then hide the toolbarBox
        this.focusProtectFlag = false;

        // NOTE undo redo 
        this.undoWaitSeconds = 2000;
        this.undoWaitFlag = true;
        this.undoModifyFlag = false;
        this.undoStack = [];
        this.redoStack = [];
        this.lastTextBody = this.props.NOTE.state.note.body

        // NOTE bodyScrollLimit will auto hide the keyboard
        this.bodyScrollLimitMin = 80;
        this.bodyScrollLimitMax = 150;
        this.bodyScrollOffset = 0;
        this.bodyScrollFlag = false;
        this.keyboardDisplay = false
    }

    componentDidMount() {
        // NOTE https://stackoverflow.com/questions/51970667
        this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
            this.setState({
                toolbarBoxDisplay: false,
                KeyboardHeight: e.endCoordinates.height,
            })

            // NOTE wait for keyboard popup
            setTimeout(() => {this.keyboardDisplay = true}, 1000);
        });
        this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', (e) => {
            this.keyboardDisplay = false
        });
    }

    componentDidUpdate() {
        const NOTE = this.props.NOTE


        this.undoRedoUpdate()
        this.scrollHideBoxKeyboardUpdate()

        // NOTE change text focus reset the keyboard hidden
        if (!this.focusProtectFlag && !this.bodyScrollFlag && !NOTE.state.bodyFocus && NOTE.state.keyboadrdHidden && !this.toolbarBoxDisplay) {
            NOTE.setState({ keyboadrdHidden: false })
        }
    }

    scrollHideBoxKeyboardUpdate() {
        // NOTE hide keyboard with fast scroll 
        const NOTE = this.props.NOTE
        const bodyScrollEvent = NOTE.state.bodyScrollEvent
        if (bodyScrollEvent && !this.focusProtectFlag && this.keyboardDisplay && !this.bodyScrollFlag) {
            const offsetY = bodyScrollEvent.contentOffset.y
            const offset = Math.abs(offsetY - this.bodyScrollOffset)
            if (this.bodyScrollLimitMin > offset && offset < this.bodyScrollLimitMax) {
                console.log("trigger")
                this.toggleKeyboard()

                // NOTE wait for keyborad and focus to the body 
                this.bodyScrollFlag = true
                setTimeout(() => {
                    this.bodyScrollFlag = false
                }, 1000);
            }
            this.bodyScrollOffset = offsetY
        }
    }

    undoRedoUpdate() {
        // NOTE get the text update from props for undo redo 
        const selections = this.props.NOTE.selection
        const body = this.props.NOTE.state.note.body
        if (this.lastTextBody != body) {
            let redoText = this.redoStack ? this.redoStack[this.redoStack.length - 1] : body
            redoText = typeof redoText == 'object' ? redoText.body : body
            let undoText = this.undoStack ? this.undoStack[this.undoStack.length - 1] : false
            undoText = typeof undoText == 'object' ? undoText.body : false

            // NOTE undoModifyFlag is true mean current in the undo redo stack mode
            if (!this.undoModifyFlag) {
                if (this.undoWaitFlag && body != undoText) {
                    this.undoWaitFlag = false

                    this.undoStack.push({
                        body: this.lastTextBody,
                        selections
                    })

                    setTimeout(() => {
                        this.undoWaitFlag = true
                    }, this.undoWaitSeconds);
                }
            } else if (this.lastTextBody != redoText) {
                // NOTE body had been modify clear the redo stack
                this.undoModifyFlag = false
                this.redoStack = [];
            }
            this.lastTextBody = body
        }
    }

    undo() {
        const selections = this.props.NOTE.selection
        const body = this.props.NOTE.state.note.body
        this.redoStack.push({ body, selections })

        const data = this.undoStack.pop()
        this.setText2Body(data.body, { modified: false, selections: data.selections })
        this.lastTextBody = body
        this.undoModifyFlag = true;
    }

    redo() {
        const selections = this.props.NOTE.selection
        const body = this.props.NOTE.state.note.body
        this.undoStack.push({ body, selections })

        const data = this.redoStack.pop()
        this.setText2Body(data.body, { modified: false, selections: data.selections })
        this.lastTextBody = data.body
    }

    toggleKeyboard(focus = true) {
        const NOTE = this.props.NOTE
        focus = focus === false ? false : true
        NOTE.setState({
            // NOTE disable textinput keyboard popup
            keyboadrdHidden: !NOTE.state.keyboadrdHidden,
        })
        this.focusProtectFlag = true
        Keyboard.dismiss();

        // NOTE wait for blur complete
        setTimeout(() => {
            if (focus) NOTE.focusUpdate()
            this.focusProtectFlag = false
        }, 50);
    }

    toggleToolbarBox = (focus = true) => {
        const NOTE = this.props.NOTE
        focus = focus === false ? false : true

        this.setState({
            toolbarBoxDisplay: !this.state.toolbarBoxDisplay,
        })

        if (!this.state.toolbarBoxDisplay) {
            Keyboard.dismiss();
            // NOTE animate popup toolbarBox | wait for keyboard dismiss
            setTimeout(() => {
                Animated.timing(this.state.toolbarBoxAnimHeight, {
                    easing: Easing.easeIn,
                    toValue: this.state.KeyboardHeight,
                    duration: 50
                }).start();
            }, 500);
        } else {
            Animated.timing(this.state.toolbarBoxAnimHeight, {
                easing: Easing.easeIn,
                toValue: 0,
                duration: 50
            }).start();
        }

        if (this.state.toolbarBoxDisplay == this.props.NOTE.state.keyboadrdHidden)
            NOTE.setState({
                // NOTE disable textinput keyboard popup
                keyboadrdHidden: !this.state.toolbarBoxDisplay,
            })

        this.focusProtectFlag = true
        Keyboard.dismiss();

        // NOTE wait for blur complete
        setTimeout(() => {
            if (focus) NOTE.focusUpdate()
            this.focusProtectFlag = false
        }, 100);
    }

    setText2Body(text, options = {}) {
        // NOTE text handle flag - $line $sel

        let { lineCallback, selCallback, selected, modified, selections } = options
        selected = selected != undefined ? selected : true;
        modified = modified != undefined ? modified : true;
        selections = selections && typeof selections == 'object' ? selections : false;

        // NOTE get component
        const NOTE = this.props.NOTE
        const note = NOTE.state.note

        const body = NOTE.state.note.body
        const selection = NOTE.selection
        const cursorStart = selection.start
        const cursorEnd = selection.end
        let _cursorStart = cursorStart
        let _cursorEnd = cursorEnd
        let _text = text
        let _result = undefined

        // NOTE get current selection
        const startText = body.slice(0, cursorStart)
        const endText = body.slice(cursorEnd, body.length)
        const sel_text = cursorStart != cursorEnd ? body.slice(cursorStart, cursorEnd) : ""

        // NOTE handle $sel
        const $sel = text.search(/\$sel/i)
        if ($sel != -1) {
            const startLength = text.slice(0, $sel).length
            const endLength = text.slice($sel + 4, text.length).length

            const reg = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$sel/i, "(\\S+?)"));
            let match = sel_text.match(reg)
            if (match) {
                _text = match[1]
                _cursorEnd -= startLength + endLength
            } else {
                _text = text.replace(/\$sel/i, sel_text)
                if (sel_text != "") {
                    _cursorEnd += startLength + endLength
                } else {
                    _cursorStart += startLength
                    _cursorEnd += startLength
                }
            }

            _result = selCallback ? selCallback({ body, cursorStart, cursorEnd, sel_text, _text, _cursorStart, _cursorEnd }) : null;
            if (_result) {
                _text = _result._text != undefined ? _result._text : _text
                _cursorEnd = _result._cursorEnd != undefined ? _result._cursorEnd : _cursorEnd
                _cursorStart = _result._cursorStart != undefined ? _result._cursorStart : _cursorStart
            }
        } else {
            // NOTE no flag just move the cursor to the added position
            _cursorEnd += text.length
            _cursorStart += text.length
        }

        _text = startText + _text + endText

        // NOTE handle $line 
        if (text.search(/\$line/i) != -1) {
            const _lineStart = startText.lastIndexOf("\n") + 1
            const lineStart = _lineStart < 1 ? 0 : _lineStart
            const _lineEnd = endText.indexOf("\n") + selection.end
            const lineEnd = _lineEnd < selection.end ? body.length : _lineEnd
            const selectedLine = body.slice(lineStart, lineEnd)

            _text = body.slice(0, lineStart) + text.replace(/\$line/i, selectedLine) + body.slice(lineEnd, body.length)

            // NOTE '$line' length is 5, minus it get the added text length
            _cursorEnd = cursorEnd + text.length - 5
            // NOTE erase selected area
            _cursorStart = _cursorEnd

            _result = lineCallback ? lineCallback({ body, lineStart, lineEnd, selectedLine, cursorStart, cursorEnd, _text, _cursorStart, _cursorEnd }) : null;
            if (_result) {
                _text = _result._text != undefined ? _result._text : _text
                _cursorEnd = _result._cursorEnd != undefined ? _result._cursorEnd : _cursorEnd
                _cursorStart = _result._cursorStart != undefined ? _result._cursorStart : _cursorStart
            }
        }

        const $cursorStart = _text.search(/\$cursorStart/i)
        if ($cursorStart != -1) {
            _text = _text.replace(/\$cursorStart/i, "")
            _cursorStart = $cursorStart
        }
        const $cursorEnd = _text.search(/\$cursorEnd/i)
        if ($cursorEnd != -1) {
            _text = _text.replace(/\$cursorEnd/i, "")
            _cursorEnd = $cursorEnd
        }
        const $cursor = _text.search(/\$cursor/i)
        if ($cursor != -1) {
            _text = _text.replace(/\$cursor/i, "")
            _cursorStart = $cursor
            _cursorEnd = $cursor
        }

        // NOTE if selected flag false , make sure nothing select
        _cursorStart = selected ? _cursorStart : _cursorEnd
        // NOTE if modified flag false , make sure the text is body content | ';' split line for '[]' unless incorrect result
        _text = modified ? _text : text;
        // NOTE if selections flag has value , reset current selection
        [_cursorStart, _cursorEnd] = selections ? [selections.start, selections.end] : [_cursorStart, _cursorEnd]

        // NOTE.saveOneProperty('body',_text)
        note.body = _text
        NOTE.setState({
            note,
            selection: {
                start: _cursorStart,
                end: _cursorEnd,
            },
            toolbarEditFlag: true, // NOTE enable selection update prevent selection flicker issue
        });

    }

    toggleLineAction(data, options = {}) {
        let { toggleCallback, multiline, toggle } = options
        multiline = multiline ? multiline : true;
        toggle = toggle != undefined ? toggle : true;

        let { body, selectedLine, reg, text, lineStart, lineEnd, cursorStart, cursorEnd } = data
        const pattern = text.replace(/\$line/i, "")
        const length = pattern.length
        reg = reg ? reg : new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // NOTE escapeRegExp


        let _lineStart = selectedLine.lastIndexOf("\n") + 1
        _lineStart = _lineStart < 1 ? lineStart : lineStart + _lineStart
        lineStart = multiline ? lineStart : _lineStart
        let currentLine = body.slice(lineStart, lineEnd)

        let lines = multiline ? body.slice(lineStart, lineEnd).split("\n") : [currentLine]
        let _cursorStart = cursorStart
        let _cursorEnd = cursorEnd

        let _lines = []
        let _currentLine = ""
        for (let idx in lines) {
            currentLine = lines[idx]
            const _toggle = toggle ? currentLine.search(reg) == -1 : true
            if (_toggle) {
                // NOTE add action
                _currentLine = text.replace(/\$line/i, currentLine)
                _cursorStart += lines.length == 1 ? length : 0
                _cursorEnd += length
            } else {
                // NOTE remove action
                _currentLine = currentLine.slice(length)
                _cursorStart -= lines.length == 1 ? length : 0
                _cursorEnd -= length
            }

            const result = toggleCallback ? toggleCallback({ idx, currentLine, _toggle, _lines, _currentLine, _cursorStart, _cursorEnd }) : null
            if (result) {
                _currentLine = result._currentLine != undefined ? result._currentLine : _currentLine
                _cursorStart = result._cursorStart != undefined ? result._cursorStart : _cursorStart
                _cursorEnd = result._cursorEnd != undefined ? result._cursorEnd : _cursorEnd
            }

            _lines.push(_currentLine)
        }
        const _text = body.slice(0, lineStart) + _lines.join("\n") + body.slice(lineEnd, body.length)

        _cursorStart = multiline ? _cursorStart : _cursorEnd
        return {
            _text,
            _cursorStart,
            _cursorEnd,
        }
    }

    render() {
        const NOTE = this.props.NOTE
        let buttons = this.props.buttons ? this.props.buttons : [];

        const defualt_buttons = [
            {
                icon: 'format-bold',
                text: "**$sel**",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: 'format-italic',
                text: "*$sel*",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: 'format-underline',
                text: "++$sel++",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: 'checkbox-marked-outline',
                text: "- [ ] $line",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        lineCallback: (args) => {
                            return this.toggleLineAction({ reg: /- \[(?:x| )\]/i, text, ...args })
                        }
                    })
                }
            },
            {
                icon: 'format-color-highlight',
                text: '<mark>$sel</mark>',
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: 'format-list-numbered',
                text: '1. $line',
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        lineCallback: (args) => {
                            const { body, lineStart } = args
                            return this.toggleLineAction({ reg: /^\d+\. /i, text, ...args }, {
                                toggleCallback: ({ idx, currentLine, _toggle, _lines, _currentLine, _cursorStart, _cursorEnd }) => {

                                    // NOTE text pattern length 
                                    const patternLength = "1. ".length

                                    // NOTE get the current loop line last line 
                                    let lastLine = ""
                                    let match = ""
                                    if (idx > 0) {
                                        lastLine = _lines[idx - 1]
                                    } else {
                                        const startText = body.slice(0, lineStart)
                                        const splitLines = startText.split("\n")
                                        lastLine = splitLines[splitLines.length - 2]
                                        // NOTE if lastLine is undefined mean currentLine is the first line 
                                        lastLine = lastLine ? lastLine : ""
                                    }

                                    if (_toggle) {
                                        match = lastLine.match(/^(\d+)\. /i)
                                        if (match) {
                                            const num = `${Number(match[1]) + 1}. `
                                            _currentLine = num + currentLine.replace(/^\s+/, "")
                                            _cursorStart += num.length - patternLength
                                            _cursorEnd += num.length - patternLength
                                        }
                                    } else {
                                        match = currentLine.match(/^\d+\. /i)
                                        const length = String(match[0]).length
                                        _currentLine = currentLine.slice(length)

                                        _cursorStart -= length - patternLength
                                        _cursorEnd -= length - patternLength
                                    }

                                    return { _currentLine, _cursorStart, _cursorEnd }
                                }
                            })
                        }
                    })
                }
            },
            {
                icon: 'format-list-bulleted',
                text: '* $line',
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        lineCallback: (args) => {
                            return this.toggleLineAction({ text, ...args })
                        }
                    })
                }
            },
            {
                icon: 'format-indent-increase',
                text: '    $line',
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        lineCallback: (args) => {
                            return this.toggleLineAction({ text, ...args }, { toggle: false })
                        }
                    })
                }
            },
            {
                icon: 'format-indent-decrease',
                text: '$line',
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        lineCallback: (args) => {
                            return this.toggleLineAction({ text, ...args }, {
                                toggleCallback: ({ idx, currentLine, _toggle, _lines, _currentLine, _cursorStart, _cursorEnd }) => {
                                    if (currentLine.match(/^    /i)) {
                                        _currentLine = currentLine.replace(/^    /i, "")
                                        // _cursorStart -= idx == 0 ? 4 : 0
                                        _cursorEnd -= 4
                                    }
                                    return { _currentLine, _cursorStart, _cursorEnd }
                                }
                            })
                        }
                    })
                }
            },
            {
                icon: 'minus',
                text: '$sel\n---\n',
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        selected: false,
                        selCallback: ({ body, cursorStart, cursorEnd, sel_text, _text, _cursorStart, _cursorEnd }) => {
                            _cursorEnd = cursorEnd + "\n---\n".length
                            _cursorStart = _cursorEnd
                            return {
                                _text,
                                _cursorStart,
                                _cursorEnd,
                            }
                        }
                    })
                }
            },
            {
                icon: 'format-strikethrough-variant',
                text: '~~$sel~~',
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: '|',
                text: "splitter",
                iconComponent: (icon, styles) => {
                    return <Text style={styles}>{icon}</Text>
                },
                disabled: true,
                styles: {
                    fontSize: 25,
                    fontWeight: 'bold',
                    width: 5,
                    height: 35,
                }

            },
            {
                icon: 'content-paste',
                text: "",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: async () => {
                    const clipboardContent = await Clipboard.getString();
                    return this.setText2Body(clipboardContent)
                },
            },
            {
                icon: 'undo',
                text: "",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: this.undo.bind(this),
                disabled: this.undoStack.length != 0 ? false : true,
                styles: {
                    color: this.undoStack.length != 0 ? 'black' : 'darkgray'
                },
            },
            {
                icon: 'redo',
                text: "",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: this.redo.bind(this),
                disabled: this.redoStack.length != 0 ? false : true,
                styles: {
                    color: this.redoStack.length != 0 ? 'black' : 'darkgray'
                }
            },
            {
                icon: 'keyboard-close',
                text: "",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={this.props.NOTE.state.keyboadrdHidden ? 'keyboard' : icon} style={styles} />
                },
                onPress: this.toggleKeyboard.bind(this),
                disabled: this.state.toolbarBoxDisplay ? true : false,
                styles: {
                    color: this.state.toolbarBoxDisplay ? 'darkgray' : 'black'
                }
            },
            {
                icon: 'tooltip-plus-outline',
                text: "",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons disabled={true} name={icon} style={styles} />
                },
                onPress: this.toggleToolbarBox.bind(this)
            },

        ];

        const toolbox_buttons = [
            {
                icon: 'format-header-pound',
                text: "#$line",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        lineCallback: ({ body, lineStart, lineEnd, selectedLine, cursorStart, cursorEnd }) => {
                            const _lineStart = selectedLine.lastIndexOf("\n") + 1
                            lineStart = _lineStart < 1 ? lineStart : lineStart + _lineStart
                            let currentLine = body.slice(lineStart, lineEnd)

                            if (currentLine.search(/^#+ /g) == -1) {
                                // NOTE currently doesn't have any '#'  | remove space and add the space in front of the line
                                currentLine = " " + currentLine.replace(/^\s+/, "")
                                text = text.replace(/\$line/i, currentLine)
                                cursorEnd += 2
                            } else if (currentLine.match(/^#+ /g)[0].length < 7) {
                                // NOTE this mean alreay has the '#' | check the beyond num
                                text = text.replace(/\$line/i, currentLine)
                                cursorEnd += 1
                            } else {
                                // NOTE this mean '#' more than 6 and do nothing
                                text = currentLine
                            }

                            return {
                                'text': body.slice(0, lineStart) + text + body.slice(lineEnd, body.length),
                                'cursorStart': cursorEnd,
                                'cursorEnd': cursorEnd,
                            }
                        }
                    })
                }
            },
            {
                icon: 'format-quote-open',
                text: "> $line",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text, {
                        lineCallback: (args) => {
                            return this.toggleLineAction({ text, ...args })
                        }
                    })
                }
            },
            {
                icon: 'table',
                text: "\n|$sel   |   |\n|---|---|\n|   |   |\n",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: 'code-tags',
                text: "\n```$sel\n\n```",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: 'link',
                text: "($sel)[]",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
            {
                icon: 'image',
                text: "!($sel)[]",
                iconComponent: (icon, styles) => {
                    return <MaterialCommunityIcons name={icon} style={styles} />
                },
                onPress: (text) => {
                    return this.setText2Body(text)
                }
            },
        ]

        buttons = defualt_buttons.concat(buttons);

        const iconButton = ({ item }) => {
            const style = item.styles ? { ...styles.icon, ...item.styles } : styles.icon
            return (
                <TouchableNativeFeedback
                    disabled={item.disabled == undefined ? false : item.disabled}
                    onPress={() => {
                        return item.onPress ? item.onPress(item.text) : null;
                    }}
                    onLongPress={() => {
                        return item.onLongPress ? item.onLongPress(item.text) : null;
                    }}
                >
                    <View>
                        {item.iconComponent ? item.iconComponent(item.icon, style) : <MaterialCommunityIcons name={item.icon} style={style} />}
                    </View>
                </TouchableNativeFeedback>
            )
        }

        const toolbarBox = () => {

            return (
                <Animated.View style={{ height: this.state.toolbarBoxAnimHeight }}>
                    <FlatList
                        // NOTE keep keyboard stay and button can tap to trigger event
                        keyboardDismissMode='on-drag'
                        keyboardShouldPersistTaps="always"
                        data={toolbox_buttons}
                        renderItem={({ item }) => {
                            return <View style={styles.toolbarBoxItem}>
                                {iconButton({ item })}
                            </View>
                        }}
                        //Setting the number of column
                        numColumns={5}
                        keyExtractor={(item, index) => index}
                    />
                </Animated.View>
            )
        }

        if (!this.focusProtectFlag && !NOTE.state.bodyFocus && this.state.toolbarBoxDisplay) {
            this.toggleToolbarBox(false)
        }

        return (
            // NOTE hide the toolbar if it not focus on the text body 
            // NOTE display flag will reset the component state , use height to zero hold the state
            <View style={NOTE.state.bodyFocus ? {} : { height: 0 }}>
                <View style={styles.toolbarView}>
                    <FlatList
                        ref={ref => this.flatList = ref}
                        // NOTE keep keyboard stay and button can tap to trigger event
                        keyboardDismissMode='on-drag'
                        keyboardShouldPersistTaps="always"
                        onScroll={(r) => {
                            // NOTE scroll to the end change to arrow button
                            const width = r.nativeEvent.contentSize.width - r.nativeEvent.layoutMeasurement.width
                            this.setState({
                                scrollEndFlag: width - r.nativeEvent.contentOffset.x < 4 ? true : false,
                            })
                        }}
                        data={buttons}
                        keyExtractor={(item, index) => index}
                        horizontal={true}
                        showsHorizontalScrollIndicator={false}
                        renderItem={iconButton}
                    />
                    <TouchableNativeFeedback
                        onPress={() => {
                            if (this.state.scrollEndFlag)
                                this.flatList.scrollToOffset({ offset: 0, animated: true });
                            else
                                this.flatList.scrollToEnd({ animated: true })
                        }}
                    >
                        <View style={styles.arrow}>
                            <MaterialCommunityIcons name={this.state.scrollEndFlag ? "arrow-left" : "arrow-right"} style={styles.icon} />
                        </View>
                    </TouchableNativeFeedback>
                </View>
                {toolbarBox()}
            </View>
        );
    }
}

module.exports = { MarkdwonToolbarComponent };
