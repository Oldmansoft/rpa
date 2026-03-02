import { useState, useRef, useCallback, useEffect } from "react"
import { python } from "@codemirror/lang-python"
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { createTheme } from "@uiw/codemirror-themes"
import {
    autocompletion,
    completeFromList,
    Completion,
    CompletionContext,
    CompletionSource
} from "@codemirror/autocomplete"
import { EditorState, Transaction, TransactionSpec } from "@codemirror/state"
import { Prec } from "@codemirror/state"
import CodeMirror from "@uiw/react-codemirror"

const expressionTheme = createTheme({
    theme: "light",
    settings: {
        background: "#ffffff",
        foreground: "#1e293b",
        caret: "#3b82f6",
        selection: "#bfdbfe80",
        lineHighlight: "transparent",
        gutterBackground: "transparent",
        gutterForeground: "transparent",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
        fontSize: "14px",
    },
    styles: [
        { tag: t.keyword, color: "#c084fc", fontWeight: "600" },
        { tag: t.operator, color: "#f97316", fontWeight: "bold" },
        { tag: t.string, color: "#22c55e" },
        { tag: t.variableName, color: "#3b82f6" },
        { tag: t.number, color: "#f59e0b" },
        { tag: t.comment, color: "#94a3b8", fontStyle: "italic" },
        { tag: t.bool, color: "#ef4444", fontWeight: "bold" },
    ],
})

const variables = [
    "user_name",
    "user_age",
    "order_total",
    "today",
]

const InputExpression = ({ onNativeChange, onInput, value, placeholder, className }: {
    onNativeChange?: (value: string) => boolean,
    onInput?: (value: string) => string,
    value: string,
    placeholder?: string,
    className?: string
}) => {
    const [innerValue, setInnerValue] = useState(value)
    const prevValueRef = useRef(value)
    const onEnterRef = useRef<() => void>(() => { })
    const focusRef = useRef<() => void>(() => { })
    const blurRef = useRef<() => void>(() => { })

    useEffect(() => {
        if (value != innerValue) {
            setInnerValue(value)
        }
    }, [value])

    const variableCompletions: CompletionSource = (context: CompletionContext) => {
        const word = context.matchBefore(/\w*/)
        if (!word) return null

        const completions: Completion[] = variables.map((v) => ({
            label: v,
            type: "variable",
            detail: "变量",
            boost: 99
        }))

        return completeFromList(completions)(context)
    }

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
        focusRef.current = () => { prevValueRef.current = innerValue }
    }, [innerValue])

    const disableEnter = Prec.highest(
        keymap.of([
            {
                key: "Enter",
                run: () => {
                    onEnterRef.current?.()
                    return true
                },
            },
        ])
    )

    const noNewlineFilter = EditorState.transactionFilter.of((tr: Transaction): readonly TransactionSpec[] => {
        if (!tr.docChanged) return [tr]

        const newText = tr.newDoc.toString();
        if (!newText.includes("\n")) return [tr]

        const cleanedText = newText.replace(/\n/g, " ");

        return [{
            changes: { from: 0, to: tr.startState.doc.length, insert: cleanedText },
        }];
    });


    const extensions = [
        disableEnter,
        EditorView.domEventHandlers({
        focus: () => focusRef.current?.(),
        blur: () => blurRef.current?.(),
    }),
        python(),
        expressionTheme,
        autocompletion({
            icons: true,
            defaultKeymap: true,
            maxRenderedOptions: 12
        }),
        EditorState.languageData.of(() => [
            { autocomplete: variableCompletions }
        ]),
        noNewlineFilter,
        EditorView.theme({
            ".cm-scroller": {
                overflowX: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none"
            },
            ".cm-scroller::-webkit-scrollbar": { display: "none" },
            ".cm-content": { whiteSpace: "pre" }
        }),
    ]
    const basicSetup = {
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        allowMultipleSelections: false,
        indentWithTab: false
    }

    const handleChange = (content: string) => {
        setInnerValue(onInput ? onInput(content) : content)
    }

    return (
        <div
            className={className}
            style={{
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            }}
        >
            <CodeMirror value={innerValue} placeholder={placeholder} onChange={handleChange} extensions={extensions} basicSetup={basicSetup} width="100%" indentWithTab={false}></CodeMirror>
        </div>

    )
}

export default InputExpression