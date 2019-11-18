import * as types from "babel-types";
import { ErrNotDefined } from "../../error";
import { __generator, _toConsumableArray, __awaiter } from "../../runtime";
import { ES5Map, Kind } from "../../type";
import { Stack } from "../../stack";
import { UNDEFINED, ANONYMOUS } from "../../constant";
import { IVar } from "../../var";
import { isFunctionDeclaration, isVariableDeclaration } from "../../packages/babel-types";

// qinghe
import { Literal } from './literal'
import { Declaration } from './declaration';
import { Expression } from './expression';
import { Statement } from './statement';

export const BinaryExpressionOperatorEvaluateMap = {
  // tslint:disable-next-line
  "==": (a, b) => a == b,
  // tslint:disable-next-line
  "!=": (a, b) => a != b,
  "===": (a, b) => a === b,
  "!==": (a, b) => a !== b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  // tslint:disable-next-line
  "<<": (a, b) => a << b,
  // tslint:disable-next-line
  ">>": (a, b) => a >> b,
  // tslint:disable-next-line
  ">>>": (a, b) => a >>> b,
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "%": (a, b) => a % b,
  // tslint:disable-next-line
  "|": (a, b) => a | b,
  // tslint:disable-next-line
  "^": (a, b) => a ^ b,
  // tslint:disable-next-line
  "&": (a, b) => a & b,
  // "**": (a, b) => {
  //   throw ErrImplement('**')
  // },
  in: (a, b) => a in b,
  instanceof: (a, b) => a instanceof b
};

export const AssignmentExpressionEvaluateMap = {
"=": ($var: IVar, v) => {
  $var.set(v);
  return v;
},
"+=": ($var: IVar, v) => {
  $var.set($var.value + v);
  return $var.value;
},
"-=": ($var: IVar, v) => {
  $var.set($var.value - v);
  return $var.value;
},
"*=": ($var: IVar, v) => {
  $var.set($var.value * v);
  return $var.value;
},
"**=": ($var: IVar, v) => {
  $var.set(Math.pow($var.value, v));
  return $var.value;
},
"/=": ($var: IVar, v) => {
  $var.set($var.value / v);
  return $var.value;
},
"%=": ($var: IVar, v) => {
  $var.set($var.value % v);
  return $var.value;
},
"<<=": ($var: IVar, v) => {
  // tslint:disable-next-line: no-bitwise
  $var.set($var.value << v);
  return $var.value;
},
">>=": ($var: IVar, v) => {
  // tslint:disable-next-line: no-bitwise
  $var.set($var.value >> v);
  return $var.value;
},
">>>=": ($var: IVar, v) => {
  // tslint:disable-next-line: no-bitwise
  $var.set($var.value >>> v);
  return $var.value;
},
"|=": ($var: IVar, v) => {
  // tslint:disable-next-line: no-bitwise
  $var.set($var.value | v);
  return $var.value;
},
"^=": ($var: IVar, v) => {
  // tslint:disable-next-line: no-bitwise
  $var.set($var.value ^ v);
  return $var.value;
},
"&=": ($var: IVar, v) => {
  // tslint:disable-next-line: no-bitwise
  $var.set($var.value & v);
  return $var.value;
}
};

export function overriteStack(err: Error, stack: Stack, node: types.Node): Error {
  stack.push({
    filename: ANONYMOUS,
    stack: stack.currentStackName,
    location: node.loc
  });
  err.stack = err.toString() + "\n" + stack.raw;
  return err;
}

export const es5: ES5Map = {
  File(path) {
    path.evaluate(path.createChild(path.node.program));
  },
  Program(path) {
    const { node: program, scope } = path;
    // 声明提升
    for (const node of program.body) {
      if (isFunctionDeclaration(node)) {
        // 函数声明提升,跳转到 FunctionDeclaration
        path.evaluate(path.createChild(node));
      } else if (isVariableDeclaration(node)) {
        // 变量声明提升, 跳转到 VariableDeclaration
        for (const declaration of node.declarations) {
          if (node.kind === Kind.Var) {
            scope.var((declaration.id as types.Identifier).name, undefined);
          }
        }
      }
    }

    for (const node of program.body) {
      if (!isFunctionDeclaration(node)) {
        path.evaluate(path.createChild(node));
      }
    }
  },
  Identifier(path) {
    const { node, scope, stack } = path;
    if (node.name === UNDEFINED) {
      return undefined;
    }
    const $var = scope.hasBinding(node.name);
    if ($var) {
      return $var.value;
    } else {
      throw overriteStack(ErrNotDefined(node.name), stack, node);
    }
  },
  ...Literal,
  ...Declaration,
  ...Expression,
  ...Statement
};
