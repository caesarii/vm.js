import * as types from "babel-types";
import isFunction from "lodash.isfunction";
import {
  ErrNoSuper,
  ErrNotDefined,
  ErrIsNotFunction,
  ErrCanNotReadProperty,
} from "../../error";
import { __generator, _toConsumableArray, __awaiter } from "../../runtime/runtime";
import { Var, IVar } from "../../runtime/var";
import { Kind, ScopeType } from "../../type";
import { Signal } from "../../runtime/signal";
import { THIS, UNDEFINED, ANONYMOUS } from "../../constant";

import {
  isIdentifier,
  isMemberExpression,
  isSpreadElement,
  isStringLiteral
} from "../../packages/babel-types";
import { defineFunctionLength, defineFunctionName } from "../../utils";
import { Prototype } from "../../runtime/Prototype";
import { This } from "../../runtime/This";
import { overriteStack, BinaryExpressionOperatorEvaluateMap, AssignmentExpressionEvaluateMap } from './es5';

export const Expression = {
    UpdateExpression(path) {
        const { node, scope, stack } = path;
        const { prefix } = node;
        let $var: IVar;
        if (isIdentifier(node.argument)) {
          const { name } = node.argument;
          const $$var = scope.hasBinding(name);
          if (!$$var) {
            throw overriteStack(ErrNotDefined(name), stack, node.argument);
          }
          $var = $$var;
        } else if (isMemberExpression(node.argument)) {
          const argument = node.argument;
          const object = path.evaluate(path.createChild(argument.object));
          const property = argument.computed
            ? path.evaluate(path.createChild(argument.property))
            : (argument.property as types.Identifier).name;
          $var = {
            kind: Kind.Const,
            set(value: any) {
              object[property] = value;
            },
            get value() {
              return object[property];
            }
          };
        }
    
        return {
          "--": v => {
            $var.set(v - 1);
            return prefix ? --v : v--;
          },
          "++": v => {
            $var.set(v + 1);
            return prefix ? ++v : v++;
          }
        }[node.operator](path.evaluate(path.createChild(node.argument)));
    },
    ThisExpression(path) {
    const { scope } = path;
    // use this in class constructor it it never call super();
    if (scope.type === ScopeType.Constructor) {
        if (!scope.hasOwnBinding(THIS)) {
        throw overriteStack(ErrNoSuper(), path.stack, path.node);
        }
    }
    const thisVar = scope.hasBinding(THIS);
    return thisVar ? thisVar.value : null;
    },
    ArrayExpression(path) {
    const { node } = path;
    let newArray: any[] = [];
    for (const item of node.elements) {
        if (item === null) {
        newArray.push(undefined);
        } else if (isSpreadElement(item)) {
        const arr = path.evaluate(path.createChild(item));
        newArray = ([] as any[]).concat(newArray, _toConsumableArray(arr));
        } else {
        newArray.push(path.evaluate(path.createChild(item)));
        }
    }
    return newArray;
    },
    ObjectExpression(path) {
    const { node, scope } = path;
    const object = {};
    const newScope = scope.createChild(ScopeType.Object);
    const computedProperties: Array<
        types.ObjectProperty | types.ObjectMethod
    > = [];

    for (const property of node.properties) {
        const tempProperty = property as
        | types.ObjectMethod
        | types.ObjectProperty;
        if (tempProperty.computed === true) {
        computedProperties.push(tempProperty);
        continue;
        }
        path.evaluate(path.createChild(property, newScope, { object }));
    }

    // eval the computed properties
    for (const property of computedProperties) {
        path.evaluate(path.createChild(property, newScope, { object }));
    }

    return object;
    },
    ObjectProperty(path) {
    const { node, scope, ctx } = path;
    const { object } = ctx;
    const val = path.evaluate(path.createChild(node.value));
    if (isIdentifier(node.key)) {
        object[node.key.name] = val;
        scope.var(node.key.name, val);
    } else {
        object[path.evaluate(path.createChild(node.key))] = val;
    }
    },
    ObjectMethod(path) {
    const { node, scope, stack } = path;
    const methodName: string = !node.computed
        ? isIdentifier(node.key)
        ? node.key.name
        : path.evaluate(path.createChild(node.key))
        : path.evaluate(path.createChild(node.key));
    const method = function() {
        stack.enter("Object." + methodName);
        const args = [].slice.call(arguments);
        const newScope = scope.createChild(ScopeType.Function);
        newScope.const(THIS, this);
        // define arguments
        node.params.forEach((param, i) => {
        newScope.const((param as types.Identifier).name, args[i]);
        });
        const result = path.evaluate(path.createChild(node.body, newScope));
        stack.leave();
        if (Signal.isReturn(result)) {
        return result.value;
        }
    };
    defineFunctionLength(method, node.params.length);
    defineFunctionName(method, methodName);

    const objectKindMap = {
        get() {
        Object.defineProperty(path.ctx.object, methodName, { get: method });
        scope.const(methodName, method);
        },
        set() {
        Object.defineProperty(path.ctx.object, methodName, { set: method });
        },
        method() {
        Object.defineProperty(path.ctx.object, methodName, { value: method });
        }
    };

    const definer = objectKindMap[node.kind];

    if (definer) {
        definer();
    }
    },

    BinaryExpression(path) {
    const { node } = path;
    return BinaryExpressionOperatorEvaluateMap[node.operator](
        path.evaluate(path.createChild(node.left)),
        path.evaluate(path.createChild(node.right))
    );
    },
    UnaryExpression(path) {
    const { node, scope } = path;
    return {
        "-": () => -path.evaluate(path.createChild(node.argument)),
        "+": () => +path.evaluate(path.createChild(node.argument)),
        "!": () => !path.evaluate(path.createChild(node.argument)),
        // tslint:disable-next-line
        "~": () => ~path.evaluate(path.createChild(node.argument)),
        void: () => void path.evaluate(path.createChild(node.argument)),
        typeof: (): string => {
        if (isIdentifier(node.argument)) {
            const $var = scope.hasBinding(node.argument.name);
            return $var ? typeof $var.value : UNDEFINED;
        } else {
            return typeof path.evaluate(path.createChild(node.argument));
        }
        },
        delete: () => {
        if (isMemberExpression(node.argument)) {
            const { object, property, computed } = node.argument;
            if (computed) {
            return delete path.evaluate(path.createChild(object))[
                path.evaluate(path.createChild(property))
            ];
            } else {
            return delete path.evaluate(path.createChild(object))[
                (property as types.Identifier).name
            ];
            }
        } else if (isIdentifier(node.argument)) {
            const $this = scope.hasBinding(THIS);
            if ($this) {
            return $this.value[node.argument.name];
            }
        }
        }
    }[node.operator]();
    },
    CallExpression(path) {
    const { node, scope, stack } = path;

    const functionName: string = isMemberExpression(node.callee)
        ? (() => {
            if (isIdentifier(node.callee.property)) {
            return (
                (node.callee.object as any).name + "." + node.callee.property.name
            );
            } else if (isStringLiteral(node.callee.property)) {
            return (
                (node.callee.object as any).name +
                "." +
                node.callee.property.value
            );
            } else {
            return "undefined";
            }
        })()
        : (node.callee as types.Identifier).name;

    const func = path.evaluate(path.createChild(node.callee));
    const args = node.arguments.map(arg =>
        path.evaluate(path.createChild(arg))
    );
    const isValidFunction = isFunction(func) as boolean;

    let context: any = null;

    if (isMemberExpression(node.callee)) {
        if (!isValidFunction) {
        throw overriteStack(
            ErrIsNotFunction(functionName),
            stack,
            node.callee.property
        );
        } else {
        stack.push({
            filename: ANONYMOUS,
            stack: stack.currentStackName,
            location: node.callee.property.loc
        });
        }
        context = path.evaluate(path.createChild(node.callee.object));
    } else {
        if (!isValidFunction) {
        throw overriteStack(ErrIsNotFunction(functionName), stack, node);
        } else {
        stack.push({
            filename: ANONYMOUS,
            stack: stack.currentStackName,
            location: node.loc
        });
        }
        const thisVar = scope.hasBinding(THIS);
        context = thisVar ? thisVar.value : null;
    }

    const result = func.apply(context, args);

    if (result instanceof Error) {
        result.stack = result.toString() + "\n" + stack.raw;
    }

    return result;
    },
    MemberExpression(path) {
    const { node } = path;
    const { object, property, computed } = node;

    const propertyName: string = computed
        ? path.evaluate(path.createChild(property))
        : (property as types.Identifier).name;

    const obj = path.evaluate(path.createChild(object));

    if (obj === undefined) {
        throw ErrCanNotReadProperty(propertyName, "undefined");
    }

    if (obj === null) {
        throw ErrCanNotReadProperty(propertyName, "null");
    }

    const isPrototype =
        propertyName === "prototype" && types.isIdentifier(property);

    const target = isPrototype ? new Prototype(obj) : obj[propertyName];

    return target instanceof Prototype
        ? target
        : isFunction(target)
        ? target.bind(obj)
        : target;
    },
    AssignmentExpression(path) {
    const { node, scope } = path;
    let $var: IVar = {
        kind: Kind.Var,
        set(value: any) {
        //
        },
        get value() {
        return undefined;
        }
    };
    let rightValue;

    if (isIdentifier(node.left)) {
        const { name } = node.left;
        const varOrNot = scope.hasBinding(name);
        // right first
        rightValue = path.evaluate(path.createChild(node.right));

        if (!varOrNot) {
        // here to define global var
        const globalScope = scope.global;
        globalScope.var(name, path.evaluate(path.createChild(node.right)));
        const globalVar = globalScope.hasBinding(name);
        if (globalVar) {
            $var = globalVar;
        } else {
            throw overriteStack(ErrNotDefined(name), path.stack, node.right);
        }
        } else {
        $var = varOrNot as Var<any>;
        /**
         * const test = 123;
         * test = 321 // it should throw an error
         */
        if ($var.kind === Kind.Const) {
            throw overriteStack(
            new TypeError("Assignment to constant variable."),
            path.stack,
            node.left
            );
        }
        }
    } else if (isMemberExpression(node.left)) {
        const left = node.left;
        const object: any = path.evaluate(path.createChild(left.object));
        // left first
        rightValue = path.evaluate(path.createChild(node.right));

        const property: string = left.computed
        ? path.evaluate(path.createChild(left.property))
        : (left.property as types.Identifier).name;

        $var = {
        kind: Kind.Var,
        set(value: any) {
            if (object instanceof Prototype) {
            const Constructor = object.constructor;
            Constructor.prototype[property] = value;
            } else {
            object[property] = value;
            }
        },
        get value() {
            return object[property];
        }
        };
    }

    return AssignmentExpressionEvaluateMap[node.operator]($var, rightValue);
    },
    LogicalExpression(path) {
    const { node } = path;
    return {
        "||": () =>
        path.evaluate(path.createChild(node.left)) ||
        path.evaluate(path.createChild(node.right)),
        "&&": () =>
        path.evaluate(path.createChild(node.left)) &&
        path.evaluate(path.createChild(node.right))
    }[node.operator]();
    },
    ConditionalExpression(path) {
    return path.evaluate(path.createChild(path.node.test))
        ? path.evaluate(path.createChild(path.node.consequent))
        : path.evaluate(path.createChild(path.node.alternate));
    },
    NewExpression(path) {
    const { node, stack } = path;
    const func = path.evaluate(path.createChild(node.callee));
    const args: any[] = node.arguments.map(arg =>
        path.evaluate(path.createChild(arg))
    );
    func.prototype.constructor = func;
    let entity = /native code/.test(func.toString())
        ? new func(...args)
        : new func(...args, new This(null));

    // stack track for Error constructor
    if (func === Error || entity instanceof Error) {
        entity = overriteStack(entity, stack, node);
    }
    return entity;
    },
    SequenceExpression(path) {
    let result;
    for (const expression of path.node.expressions) {
        result = path.evaluate(path.createChild(expression));
    }
    return result;
    }
}