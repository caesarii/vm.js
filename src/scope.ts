import { Context } from "./context";
import { ErrDuplicateDeclard } from "./error";
import { Kind, KindType, ScopeType, isolatedScopeMap } from "./type";
import { Var } from "./var";

export class Scope {
  // the scope have invasive property
  // if the scope is block scope.
  // it can define variables in parent scope via `var`
  // for example
  /**
   * var a = 2;
   *
   * for(var i=0;i<a;i++){
   *   var b = i;
   * }
   *
   * // in here, b is not defined in the top scope.
   * // but it defined in for loop
   * // mark invasive = true. then var keyword can defined variables in parent scope
   * console.log(b); // 1
   *
   */
  // 侵入性: 是指如果作用域是块级作用域, 在该作用域声明的 var 变量将不断冒泡, 最终定义在孤立型父级作用域(函数作用域)
  public invasive: boolean = false;

  /**
   * The level of scope.
   * The top scope's level is 0.
   * every child scope will increase 1
   */
  // 作用域级别, 全局作用域级别为0, 子作用域依次 +1
  public level: number = 0;

  // scope context
  // 作用域的context
  // 对于全局作用域, context 是指定的沙盒, 通常是 window
  public context: Context;

  // isolated scope.
  // if isolated = true
  // it will create a new scope in blockStatement
  // 此处可能有误, isolated 是指函数作用域, 即块声明不能创建作用域
  public isolated: boolean = true;

  // the scope fork from witch scope
  // 该作用域 fork 的源头
  public origin: Scope | null = null;

  // 作用域中的变量
  private content: { [key: string]: Var<any> } = {};

  constructor(public readonly type: ScopeType, public parent: Scope | null) {
    // 实例化 context, 该 context 会被 setContext 初始化
    this.context = new Context();
  }

  get length(): number {
    return Object.keys(this.content).length;
  }

  get raw(): { [key: string]: any } {
    const raw = {};
    for (const attr in this.content) {
      if (this.content.hasOwnProperty(attr)) {
        raw[attr] = this.content[attr].value;
      }
    }
    return raw;
  }

  /**
   * Set context of a scope
   * @param {Context} context
   * @memberof Scope
   */
  public setContext(context: Context) {
    this.context = context;
    for (const name in context) {
      if (context.hasOwnProperty(name)) {
        // here should use $var
        this.var(name, context[name]);
      }
    }
  }

  /**
   * check the scope have binding a var
   * @param {string} varName
   * @returns {(Var<any> | void)}
   * @memberof Scope
   */
  public hasBinding(varName: string): Var<any> | void {
    if (this.content.hasOwnProperty(varName)) {
      return this.content[varName];
    } else if (this.parent) {
      return this.parent.hasBinding(varName);
    } else {
      return undefined;
    }
  }

  /**
   * check scope have binding a var in current scope
   * @param {string} varName
   * @returns {(Var<any> | void)}
   * @memberof Scope
   */
  public hasOwnBinding(varName: string): Var<any> | void {
    if (this.content.hasOwnProperty(varName)) {
      return this.content[varName];
    } else {
      return undefined;
    }
  }

  /**
   * get root scope
   * @readonly
   * @type {Scope}
   * @memberof Scope
   */
  get global(): Scope {
    if (this.parent) {
      return this.parent.global;
    } else {
      return this;
    }
  }

  /**
   * Declaring variables with let
   * @param {string} varName
   * @param {*} value
   * @returns {boolean}
   * @memberof Scope
   */
  public let(varName: string, value: any): boolean {
    if (!this.content.hasOwnProperty(varName)) {
      this.content[varName] = new Var(Kind.Let, varName, value, this);
      return true;
    } else {
      throw ErrDuplicateDeclard(varName);
    }
  }

  /**
   * Declaring variables with const
   * @param {string} varName
   * @param {*} value
   * @returns {boolean}
   * @memberof Scope
   */
  public const(varName: string, value: any): boolean {
    if (!this.content.hasOwnProperty(varName)) {
      this.content[varName] = new Var(Kind.Const, varName, value, this);
      return true;
    } else {
      throw ErrDuplicateDeclard(varName);
    }
  }

  /**
   * Declaring variables with var
   * @param {string} varName
   * @param {*} value
   * @returns {boolean}
   * @memberof Scope
   */
  public var(varName: string, value: any): boolean {
    // tslint:disable-next-line
    let targetScope: Scope = this;

    // When to stop?
    // 1. if the current scope is top-level scope
    // 2. if the current scope type is one of types `function`, `constructor`
    while (targetScope.parent !== null && !isolatedScopeMap[targetScope.type]) {
      targetScope = targetScope.parent;
    }

    if (targetScope.content.hasOwnProperty(varName)) {
      const $var = targetScope.content[varName];
      if ($var.kind !== Kind.Var) {
        // only cover var with var, not const and let
        throw ErrDuplicateDeclard(varName);
      } else {
        if (targetScope.level === 0 && targetScope.context[varName]) {
          // top level context can not be cover
          // here we do nothing
          // 为什么 do nothing: 为了不覆盖 window.alert 这样的变量, 但v8实际上仍然可覆盖?
        } else {
          // new var cover the old var
          targetScope.content[varName] = new Var(
            Kind.Var,
            varName,
            value,
            targetScope
          );
        }
      }
    } else {
      // set the new var
      targetScope.content[varName] = new Var(
        Kind.Var,
        varName,
        value,
        targetScope
      );
    }
    return true;
  }

  /**
   * Declaring variables
   * @param {Kind} kind
   * @param {string} rawName
   * @param {*} value
   * @returns {boolean}
   * @memberof Scope
   */
  public declare(kind: Kind | KindType, rawName: string, value: any): boolean {
    return {
      [Kind.Const]: () => this.const(rawName, value),
      [Kind.Let]: () => this.let(rawName, value),
      [Kind.Var]: () => this.var(rawName, value)
    }[kind]();
  }

  /**
   * Delete variables
   * @param {string} varName
   * @memberof Scope
   */
  public del(varName: string): boolean {
    if (this.content.hasOwnProperty) {
      delete this.content[varName];
    }
    return true;
  }

  /**
   * Create a child scope
   * @param {ScopeType} type
   * @returns {Scope}
   * @memberof Scope
   */
  public createChild(type: ScopeType): Scope {
    const childScope = new Scope(type, this);
    childScope.level = this.level + 1;
    return childScope;
  }

  /**
   * Fork a scope
   * @param {ScopeType} [type]
   * @returns {Scope}
   * @memberof Scope
   */
  public fork(type?: ScopeType): Scope {
    // forks a new scope
    const siblingScope = new Scope(type || this.type, null);

    // copy the properties
    siblingScope.invasive = this.invasive;
    siblingScope.level = this.level;
    siblingScope.context = this.context;
    siblingScope.parent = this.parent;
    siblingScope.origin = this;

    // copy the vars
    for (const varName in this.content) {
      if (this.content.hasOwnProperty(varName)) {
        const $var = this.content[varName];
        siblingScope.declare($var.kind, $var.name, $var.value);
      }
    }
    return siblingScope;
  }

  /**
   * Locate a scope with var
   * @param {string} varName
   * @returns {(Scope | null)}
   * @memberof Scope
   */
  public locate(varName: string): Scope | void {
    if (this.hasOwnBinding(varName)) {
      return this;
    } else {
      if (this.parent) {
        return this.parent.locate.call(this.parent, varName);
      } else {
        return undefined;
      }
    }
  }
}
