import * as types from "babel-types";
import { __generator, _toConsumableArray, __awaiter } from "../../runtime";
import { Kind, ScopeType } from "../../type";
import { Signal } from "../../signal";
import { Scope } from "../../scope";
import { isFunctionDeclaration, isVariableDeclaration } from "../../packages/babel-types";

export const Statement = {
    IfStatement(path) {
        const ifScope = path.scope.createChild(ScopeType.If);
        ifScope.invasive = true;
        ifScope.isolated = false;
        if (path.evaluate(path.createChild(path.node.test, ifScope))) {
            return path.evaluate(path.createChild(path.node.consequent, ifScope));
        } else if (path.node.alternate) {
            return path.evaluate(path.createChild(path.node.alternate, ifScope));
        }
        },
        EmptyStatement(path) {
        // do nothing
        },
        BlockStatement(path) {
        const { node: block, scope } = path;

        let blockScope: Scope = !scope.isolated
            ? scope
            : scope.createChild(ScopeType.Block);

        if (scope.isolated) {
            blockScope = scope.createChild(ScopeType.Block);
            blockScope.invasive = true;
        } else {
            blockScope = scope;
        }

        blockScope.isolated = true;

        // hoisting
        for (const node of block.body) {
            if (isFunctionDeclaration(node)) {
            path.evaluate(path.createChild(node));
            } else if (isVariableDeclaration(node)) {
            for (const declaration of node.declarations) {
                if (node.kind === Kind.Var) {
                if (!scope.isolated && scope.invasive) {
                    const targetScope = (function get(s: Scope) {
                    if (s.parent) {
                        if (s.parent.invasive) {
                        return get(s.parent);
                        } else {
                        return s.parent;
                        }
                    } else {
                        return s;
                    }
                    })(scope);
                    targetScope.parent.var(
                    (declaration.id as types.Identifier).name,
                    undefined
                    );
                } else {
                    scope.var((declaration.id as types.Identifier).name, undefined);
                }
                }
            }
            }
        }

        let tempResult;
        for (const node of block.body) {
            const result = (tempResult = path.evaluate(
            path.createChild(node, blockScope)
            ));
            if (result instanceof Signal) {
            return result;
            }
        }
        // to support do-expression
        // anyway, return the last item
        return tempResult;
        },
        // babylon parse in strict mode and disable WithStatement
        // WithStatement(path) {
        // throw ErrNotSupport(path.node.type);
        // },
        DebuggerStatement(path) {
        // tslint:disable-next-line
        debugger;
        },
        LabeledStatement(path) {
        const label = path.node.label as types.Identifier;
        return path.evaluate(
            path.createChild(path.node.body, path.scope, { labelName: label.name })
        );
        },
        BreakStatement(path) {
        const label = path.node.label;
        return new Signal("break", label ? label.name : undefined);
        },
        ContinueStatement(path) {
        const label = path.node.label;
        return new Signal("continue", label ? label.name : undefined);
        },
        ReturnStatement(path) {
        return new Signal(
            "return",
            path.node.argument
            ? path.evaluate(path.createChild(path.node.argument))
            : undefined
        );
        },

        ExpressionStatement(path) {
        return path.evaluate(path.createChild(path.node.expression));
        },
        ForStatement(path) {
        const { node, scope, ctx } = path;
        const labelName = ctx.labelName as string | void;
        const forScope = scope.createChild(ScopeType.For);

        forScope.invasive = true; // 有块级作用域

        // init loop
        if (node.init) {
            path.evaluate(path.createChild(node.init, forScope));
        }

        function update(): void {
            if (node.update) {
            path.evaluate(path.createChild(node.update, forScope));
            }
        }

        function test(): boolean {
            return node.test
            ? path.evaluate(path.createChild(node.test, forScope))
            : true;
        }

        for (;;) {
            // every loop will create it's own scope
            // it should inherit from forScope
            const loopScope = forScope.fork(ScopeType.ForChild);
            loopScope.isolated = false;

            if (!test()) {
            break;
            }

            const signal = path.evaluate(
            path.createChild(node.body, loopScope, { labelName: undefined })
            );

            if (Signal.isBreak(signal)) {
            if (!signal.value) {
                break;
            }
            if (signal.value === labelName) {
                break;
            }
            return signal;
            } else if (Signal.isContinue(signal)) {
            if (!signal.value) {
                continue;
            }
            if (signal.value === labelName) {
                update();
                continue;
            }
            return signal;
            } else if (Signal.isReturn(signal)) {
            return signal;
            }

            update();
        }
        },
        ForInStatement(path) {
        const { node, scope, ctx } = path;
        const kind = (node.left as types.VariableDeclaration).kind;
        const decl = (node.left as types.VariableDeclaration).declarations[0];
        const name = (decl.id as types.Identifier).name;

        const labelName: string = ctx.labelName;

        const right = path.evaluate(path.createChild(node.right));

        for (const value in right) {
            if (Object.hasOwnProperty.call(right, value)) {
            const forInScope = scope.createChild(ScopeType.ForIn);
            forInScope.invasive = true;
            forInScope.isolated = false;
            forInScope.declare(kind, name, value);

            const signal = path.evaluate(path.createChild(node.body, forInScope));

            if (Signal.isBreak(signal)) {
                if (!signal.value) {
                break;
                }
                if (signal.value === labelName) {
                break;
                }
                return signal;
            } else if (Signal.isContinue(signal)) {
                if (!signal.value) {
                continue;
                }
                if (signal.value === labelName) {
                continue;
                }
                return signal;
            } else if (Signal.isReturn(signal)) {
                return signal;
            }
            }
        }
        },
        DoWhileStatement(path) {
        const { node, scope, ctx } = path;
        const labelName: string | void = ctx.labelName;
        // do while don't have his own scope
        do {
            const doWhileScope = scope.createChild(ScopeType.DoWhile);
            doWhileScope.invasive = true;
            doWhileScope.isolated = false;
            const signal = path.evaluate(path.createChild(node.body, doWhileScope));
            if (Signal.isBreak(signal)) {
            if (!signal.value) {
                break;
            }
            if (signal.value === labelName) {
                break;
            }
            return signal;
            } else if (Signal.isContinue(signal)) {
            if (!signal.value) {
                continue;
            }
            if (signal.value === labelName) {
                continue;
            }
            return signal;
            } else if (Signal.isReturn(signal)) {
            return signal;
            }
        } while (path.evaluate(path.createChild(node.test)));
        },
        WhileStatement(path) {
        const { node, scope, ctx } = path;
        const labelName: string | void = ctx.labelName;

        while (path.evaluate(path.createChild(node.test))) {
            const whileScope = scope.createChild(ScopeType.While);
            whileScope.invasive = true;
            whileScope.isolated = false;
            const signal = path.evaluate(path.createChild(node.body, whileScope));
            if (Signal.isBreak(signal)) {
            if (!signal.value) {
                break;
            }

            if (signal.value === labelName) {
                break;
            }

            return signal;
            } else if (Signal.isContinue(signal)) {
            if (!signal.value) {
                continue;
            }

            if (signal.value === labelName) {
                continue;
            }
            return signal;
            } else if (Signal.isReturn(signal)) {
            return signal;
            }
        }
        },
        ThrowStatement(path) {
        // TODO: rewrite the stack log
        throw path.evaluate(path.createChild(path.node.argument));
        },
        CatchClause(path) {
        return path.evaluate(path.createChild(path.node.body));
        },
        TryStatement(path) {
        const { node, scope } = path;
        try {
            const tryScope = scope.createChild(ScopeType.Try);
            tryScope.invasive = true;
            tryScope.isolated = false;
            return path.evaluate(path.createChild(node.block, tryScope));
        } catch (err) {
            const param = node.handler.param as types.Identifier;
            const catchScope = scope.createChild(ScopeType.Catch);
            catchScope.invasive = true;
            catchScope.isolated = false;
            catchScope.const(param.name, err);
            return path.evaluate(path.createChild(node.handler, catchScope));
        } finally {
            if (node.finalizer) {
            const finallyScope = scope.createChild(ScopeType.Finally);
            finallyScope.invasive = true;
            finallyScope.isolated = false;
            // tslint:disable-next-line
            return path.evaluate(path.createChild(node.finalizer, finallyScope));
            }
        }
        },
        SwitchStatement(path) {
        const { node, scope } = path;
        const discriminant = path.evaluate(path.createChild(node.discriminant)); // switch的条件
        const switchScope = scope.createChild(ScopeType.Switch);
        switchScope.invasive = true;
        switchScope.isolated = false;

        let matched = false;
        for (const $case of node.cases) {
            // 进行匹配相应的 case
            if (
            !matched &&
            (!$case.test ||
                discriminant ===
                path.evaluate(path.createChild($case.test, switchScope)))
            ) {
            matched = true;
            }

            if (matched) {
            const result = path.evaluate(path.createChild($case, switchScope));

            if (Signal.isBreak(result)) {
                break;
            } else if (Signal.isContinue(result)) {
                // SwitchStatement can not use continue keyword
                // but it can continue parent loop, like for, for-in, for-of, while
                return result;
            } else if (Signal.isReturn(result)) {
                return result;
            }
            }
        }
        },
        SwitchCase(path) {
        const { node } = path;
        for (const stmt of node.consequent) {
            const result = path.evaluate(path.createChild(stmt));
            if (result instanceof Signal) {
            return result;
            }
        }
        },
}