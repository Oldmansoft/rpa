import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { StreamLanguage } from "@codemirror/language"
import { EditorView, keymap } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"
import { createTheme } from "@uiw/codemirror-themes"

const fstringTheme = createTheme({
    theme: "light",
    settings: {
        background: "#ffffff",
        foreground: "#1e293b",
        caret: "#3b82f6",
        selection: "#bfdbfe80",
        lineHighlight: "transparent",
        fontFamily: "ui-monospace, monospace",
        fontSize: "14px",
    },
    styles: [
        { tag: t.string, color: "#6b7280" },
        { tag: t.bracket, color: "#3b82f6", fontWeight: "bold" },
        { tag: t.punctuation, color: "#3b82f6", fontWeight: "bold" },
        { tag: t.variableName, color: "#2563eb", fontWeight: "600" },
        { tag: t.propertyName, color: "#0891b2" },
        { tag: t.operator, color: "#ea580c", fontWeight: "bold" },
        { tag: t.keyword, color: "#c026d3" },
        { tag: t.function(t.variableName), color: "#7c3aed" },
        { tag: t.number, color: "#d97706" },
        { tag: t.bool, color: "#ef4444" },
    ],
})

const fstringStream = StreamLanguage.define({
    token(stream, state) {
        if (state.inExpr) {
            if (stream.match(/^[a-zA-Z_]\w*/)) return "variable"
            if (stream.match(/^\d+(\.\d+)?/)) return "number"
            if (stream.match(/^[+\-*/%=&|!<>]+/)) return "operator"
            if (stream.eat("}")) { state.inExpr = false; return "bracket" }
            stream.next()
            return null
        } else {
            if (stream.eat("{")) { state.inExpr = true; return "bracket" }
            stream.next()
            return "string"
        }
    },
    startState: () => ({ inExpr: false }),
})

export interface InputFormatProps {
    value: string
    onInput?: (value: string) => string
    onNativeChange?: (value: string) => boolean
    placeholder?: string
    className?: string
}

const InputFormat = ({
    value,
    onInput,
    onNativeChange,
    placeholder,
    className,
}: InputFormatProps) => {
    const [innerValue, setInnerValue] = useState(value)
    const prevValueRef = useRef(value)
    const onEnterRef = useRef<() => void>(() => {})
    const focusRef = useRef<() => void>(() => {})
    const blurRef = useRef<() => void>(() => {})

    useEffect(() => {
        if (value !== innerValue) {
            setInnerValue(value)
        }
    }, [value])

    const triggerChangeIfNeeded = useCallback(() => {
        if (prevValueRef.current !== innerValue) {
            if (onNativeChange?.(innerValue)) {
                prevValueRef.current = innerValue
            } else {
                setInnerValue(prevValueRef.current)
            }
        }
    }, [innerValue, onNativeChange])

    useEffect(() => {
        onEnterRef.current = triggerChangeIfNeeded
        blurRef.current = triggerChangeIfNeeded
    }, [triggerChangeIfNeeded])

    useEffect(() => {
        focusRef.current = () => {
            prevValueRef.current = innerValue
        }
    }, [innerValue])

    const extensions = useMemo(
        () => [
            fstringStream,
            fstringTheme,
            keymap.of([
                {
                    key: "Enter",
                    run: () => {
                        onEnterRef.current?.()
                        return true
                    },
                },
            ]),
            EditorView.domEventHandlers({
                focus: () => focusRef.current?.(),
                blur: () => blurRef.current?.(),
            }),
        ],
        []
    )

    const handleChange = useCallback(
        (val: string) => {
            setInnerValue(onInput ? onInput(val) : val)
        },
        [onInput]
    )

    const boxStyle = useMemo(() => ({
        border: "1px solid #cbd5e1",
        borderRadius: "6px",
        overflow: "hidden" as const,
        background: "#ffffff",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    }), [])

    return (
        <div className={className} style={boxStyle}>
            <CodeMirror
                value={innerValue}
                placeholder={placeholder}
                onChange={handleChange}
                extensions={extensions}
                basicSetup={{
                    lineNumbers: false,
                    highlightActiveLine: true,
                    foldGutter: false,
                }}
                width="100%"
                indentWithTab={false}
            />
        </div>
    )
}

export default InputFormat
