
// tslint:disable-next-line: no-console
const log = console.log;
export const Literal = {
    RegExpLiteral(path) {
        const { node } = path;
        log('regexp literal', path)
        return new RegExp(node.pattern, node.flags);
    },
    StringLiteral(path) {
        log('string literral', path)
        return path.node.value;
    },
    NumericLiteral(path) {
        log ('number literial', path)
        return path.node.value;
    },
    BooleanLiteral(path) {
        log('boolean literial', path)
        return path.node.value;
    },
    NullLiteral(path) {
        log('null literal', null)
        return null;
    }
}