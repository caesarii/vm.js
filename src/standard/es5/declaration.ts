import * as types from "babel-types";
import {
    isArrayPattern,
    isAssignmentPattern,
    isIdentifier,
    isObjectExpression,
    isObjectPattern,
    isObjectProperty,
    isRestElement,
} from "../../packages/babel-types";
import { ErrInvalidIterable } from "../../error";
import { overriteStack } from './es5';
import { Kind, ScopeType } from "../../type";
import { Scope } from "../../runtime/scope";
import { __generator, _toConsumableArray, __awaiter } from "../../runtime/runtime";
import { Signal } from "../../runtime/signal";
import { defineFunctionLength, defineFunctionName } from "../../utils";
import { This } from "../../runtime/This";
import { THIS, ARGUMENTS, NEW } from "../../constant";

export const Declaration = {
    VariableDeclaration(path) {
        const { node, scope, stack } = path;
        const kind = node.kind;
    
        for (const declaration of node.declarations) {
          const varKeyValueMap: { [k: string]: any } = {};
          /**
           * example:
           *
           * var a = 1
           */
          if (isIdentifier(declaration.id)) {
            varKeyValueMap[declaration.id.name] = declaration.init
              ? path.evaluate(path.createChild(declaration.init))
              : undefined;
          } else if (isObjectPattern(declaration.id)) {
            /**
             * example:
             *
             * const {q,w,e} = {};
             */
            const vars: Array<{ key: string; alias: string }> = [];
            for (const n of declaration.id.properties) {
              if (isObjectProperty(n)) {
                vars.push({
                  key: (n.key as any).name as string,
                  alias: (n.value as any).name as string
                });
              }
            }
            const obj = path.evaluate(path.createChild(declaration.init));
    
            for (const $var of vars) {
              if ($var.key in obj) {
                varKeyValueMap[$var.alias] = obj[$var.key];
              }
            }
          } else if (isArrayPattern(declaration.id)) {
            // @es2015 destrucuring
            // @flow
            const initValue = path.evaluate(path.createChild(declaration.init));
    
            if (!initValue[Symbol.iterator]) {
              throw overriteStack(
                ErrInvalidIterable("{(intermediate value)}"),
                stack,
                declaration.init
              );
            }
    
            declaration.id.elements.forEach((n, i) => {
              if (isIdentifier(n)) {
                const $varName: string = n.typeAnnotation
                  ? (n.typeAnnotation.typeAnnotation as any).id.name
                  : n.name;
    
                const el = initValue[i];
                varKeyValueMap[$varName] = el;
              }
            });
          } else {
            throw node;
          }
    
          // start defned var
          for (const varName in varKeyValueMap) {
            /**
             * If the scope is penetrating and defined as VAR, it is defined on its parent scope
             * example:
             *
             * {
             *   var a = 123
             * }
             */
            if (scope.invasive && kind === Kind.Var) {
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
    
              targetScope.declare(kind, varName, varKeyValueMap[varName]);
            } else {
              scope.declare(kind, varName, varKeyValueMap[varName]);
            }
          }
        }
    },
    VariableDeclarator: path => {
        const { node, scope } = path;
        // @es2015 destructuring
        if (isObjectPattern(node.id)) {
            const newScope = scope.createChild(ScopeType.Object);
            if (isObjectExpression(node.init)) {
            path.evaluate(path.createChild(node.init, newScope));
            }
            for (const n of node.id.properties) {
            if (isObjectProperty(n)) {
                const propertyName: string = (n as any).id.name;
                const $var = newScope.hasBinding(propertyName);
                const varValue = $var ? $var.value : undefined;
                scope.var(propertyName, varValue);
                return varValue;
            }
            }
        } else if (isObjectExpression(node.init)) {
            const varName: string = (node.id as types.Identifier).name;
            const varValue = path.evaluate(path.createChild(node.init));
            scope.var(varName, varValue);
            return varValue;
        } else {
            throw node;
        }
    },
    FunctionDeclaration(path) {
        // 
        const { node, scope } = path;
        const { name: functionName } = node.id;

        let func;

        if (node.async) {
            // async函数
            // FIXME: support async function
            func = function() {
            return __awaiter(this, void 0, void 0, () => {
                // tslint:disable-next-line
                const __this = this;

                // tslint:disable-next-line
                function handler(_a) {
                const functionBody = node.body;
                const block = functionBody.body[_a.label];
                // the last block
                if (!block) {
                    return [2, undefined];
                }

                const fieldContext = {
                    call: false,
                    value: null
                };
                function next(value) {
                    fieldContext.value = value;
                    fieldContext.call = true;
                    _a.sent();
                }

                const r = path.evaluate(
                    path.createChild(block, path.scope, { next })
                );

                if (Signal.isReturn(r)) {
                    return [2 /* return */, r.value];
                }
                if (fieldContext.call) {
                    return [4 /* yield */, fieldContext.value];
                } else {
                    // next block
                    _a.label++;
                    return handler(_a);
                }
                }

                return __generator(__this, handler);
            });
            };
        } else if (node.generator) {
            // generator 函数
            func = function() {
            // tslint:disable-next-line
            const __this = this;

            // tslint:disable-next-line
            function handler(_a) {
                const functionBody = node.body;
                const block = functionBody.body[_a.label];
                // the last block
                if (!block) {
                return [2, undefined];
                }

                const fieldContext = {
                call: false,
                value: null
                };
                function next(value) {
                fieldContext.value = value;
                fieldContext.call = true;
                _a.sent();
                }

                const r = path.evaluate(
                path.createChild(block, path.scope, { next })
                );

                if (Signal.isReturn(r)) {
                return [2, r.value];
                }
                if (fieldContext.call) {
                return [4, fieldContext.value];
                } else {
                // next block
                _a.label++;
                return handler(_a);
                }
            }

            return __generator(__this, handler);
            };
        } else {
            // 普通函数
            func = Declaration.FunctionExpression(path.createChild(node as any));
        }

        defineFunctionLength(func, node.params.length || 0);
        defineFunctionName(func, functionName);

        // 函数可以重复声明
        scope.var(functionName, func);
    },
    FunctionExpression(path) {
        const { node, scope, stack } = path;
    
        const functionName = node.id ? node.id.name : "";
        const func = function(...args) {
          stack.enter(functionName); // enter the stack
    
          // Is this function is a constructor?
          // if it's constructor, it should return instance
          const shouldReturnInstance =
            args.length &&
            args[args.length - 1] instanceof This &&
            args.pop() &&
            true;
    
          const funcScope = scope.createChild(ScopeType.Function);
          for (let i = 0; i < node.params.length; i++) {
            const param = node.params[i];
            if (isIdentifier(param)) {
              funcScope.let(param.name, args[i]);
            } else if (isAssignmentPattern(param)) {
              // @es2015 default parameters
              path.evaluate(path.createChild(param, funcScope, { value: args[i] }));
            } else if (isRestElement(param)) {
              // @es2015 rest parameters
              path.evaluate(
                path.createChild(param, funcScope, { value: args.slice(i) })
              );
            }
          }
    
          funcScope.const(THIS, this);
          // support new.target
          funcScope.const(NEW, {
            target:
              this && this.__proto__ && this.__proto__.constructor
                ? this.__proto__.constructor
                : undefined
          });
          funcScope.const(ARGUMENTS, arguments);
          funcScope.isolated = false;
    
          const result = path.evaluate(path.createChild(node.body, funcScope));
          stack.leave(); // leave stack
          if (result instanceof Signal) {
            return result.value;
          } else if (shouldReturnInstance) {
            return this;
          } else {
            return result;
          }
        };
    
        defineFunctionLength(func, node.params.length);
        defineFunctionName(func, node.id ? node.id.name : ""); // Anonymous function
    
        return func;
    },
}