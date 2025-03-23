export class KeyGenerator {
    value: number
    key: string

    constructor(key:string = "") {
        this.value = 0
        this.key = key
    }

    next() {
        this.value += 1
        return `${this.key}_${this.value}`
    }
}