export const utils = {
    escapeRegExChars(value: string): string {
        return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
    },
    createNode(containerClass: string): HTMLDivElement {
        const div = document.createElement("div");
        div.className = containerClass;
        div.style.position = "absolute";
        div.style.display = "none";
        return div;
    },
};

export const keys = {
    ESC: 27,
    TAB: 9,
    RETURN: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
} as const;
