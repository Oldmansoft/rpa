import { useState, useRef, useCallback, useEffect } from "react"

export interface InputProps {
    value: string
    onNativeChange?: (value: string) => boolean
    onInput?: (value: string) => string
    className?: string
}

const Input = ({ onNativeChange, onInput, value, className }: InputProps) => {
    const [innerValue, setInnerValue] = useState(value)
    const prevValueRef = useRef(value)
    const elementRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (value !== innerValue) {
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
    }, [innerValue, onNativeChange])

    const handleBlur = useCallback(() => {
        triggerChangeIfNeeded()
    }, [innerValue, onNativeChange])

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            triggerChangeIfNeeded()
        }
    }, [innerValue, onNativeChange])

    return (
        <input
            ref={elementRef}
            type="text"
            value={innerValue}
            className={className}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    )
}

export default Input