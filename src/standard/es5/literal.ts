export const Literal = {
    RegExpLiteral(path) {
        const { node } = path;
        return new RegExp(node.pattern, node.flags);
    },
    StringLiteral(path) {
        return path.node.value;
    },
    NumericLiteral(path) {
        return path.node.value;
    },
    BooleanLiteral(path) {
        return path.node.value;
    },
    NullLiteral(path) {
        return null;
    }
}