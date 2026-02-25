import { createContext } from "react";

export enum Format {
    Text,
    Code
}

export interface TabContent {
    index: number,
    values: TabContentValue[],
    setContent(content: any): void
}

export type TabContentValue = {
    file: string,
    format: Format,
    content: any,
    modified: boolean,
    stamp: number
}

export const EditorContext = createContext<TabContent>({
    index: -1,
    values: [],
    setContent: (_: any) => {}
})