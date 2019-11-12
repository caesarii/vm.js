import { parse } from "babylon";
import { Context, ISandBox } from "./context";
import evaluate from "./evaluate";
import { Path } from "./path";
import { Scope } from "./scope";
import { MODULE, EXPORTS, THIS } from "./constant";
import { ScopeType, presetMap } from "./type";
import { Stack } from "./stack";

/**
 * Run the code in context
 * @export
 * @param {string} code
 * @param {Context} context
 * @returns
 */
export function runInContext(
  code: string,
  context: Context,
  preset: presetMap = presetMap.env
) {
  // 创建全局作用域
  const scope = new Scope(ScopeType.Root, null);
  scope.level = 0; // 表示全局作用域
  scope.invasive = true; // 全局作用域是侵入性的 ?
  scope.const(THIS, undefined); // 声明 this
  scope.setContext(context); // 设置 context

  // 定义根模块, 声明 exports 为全局作用域 var 变量, 声明 module  为全局作用域 const 变量
  const $exports = {};
  const $module = { exports: $exports };
  scope.const(MODULE, $module);
  scope.var(EXPORTS, $exports);

  const ast = parse(code, {
    sourceType: "module",
    plugins: [
      "asyncGenerators",
      "classProperties",
      "decorators",
      "doExpressions",
      "exportExtensions",
      "flow",
      "objectRestSpread"
    ]
  });

  const path = new Path(ast, null, scope, {}, new Stack());
  path.preset = preset;
  path.evaluate = evaluate;

  evaluate(path);

  // exports
  const moduleVar = scope.hasBinding(MODULE);
  return moduleVar ? moduleVar.value.exports : undefined;
}

/**
 * Create a context
 * @export
 * @param {ISandBox} [sandbox={}]
 * @returns {Context}
 */
export function createContext(sandbox: ISandBox = {}): Context {
  return new Context(sandbox);
}

export default { runInContext, createContext };
