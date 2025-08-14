import { useState, useRef, useCallback, useEffect } from "react"

const Input = ({ onNativeChange, onInput, value, className }: {
        onNativeChange?: (value: string) => boolean,
        onInput?: (value: string) => string,
        value: string,
        className?: string
}) => {
    const [innerValue, setInnerValue] = useState(value)
    const prevValueRef = useRef(value)
    const elementRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (value != innerValue) {
            setInnerValue(value)
        }
    }, [value])

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInnerValue(onInput ? onInput(event.target.value) : event.target.value)
    }

    const handleFocus = useCallback(() => {
        prevValueRef.current = innerValue
    }, [innerValue])

    const triggerChangeIfNeeded = useCallback(() => {
        if (prevValueRef.current !== innerValue) {
            if (onNativeChange?.(innerValue)) {
                prevValueRef.current = innerValue
            } else {
                setInnerValue(prevValueRef.current)
            }
        }
    }, [innerValue, onNativeChange]);

    const handleBlur = useCallback(() => {
        triggerChangeIfNeeded()
    }, [innerValue, onNativeChange])

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            triggerChangeIfNeeded()
        }
    }, [innerValue, onNativeChange])

    return (
        <input ref={elementRef} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} onKeyDown={handleKeyDown} value={innerValue} className={className}></input>
    )
}

export default Input