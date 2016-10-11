/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

// TODO(usergenic): Migrate this to polymer-analyzer
// https://github.com/Polymer/polymer-analyzer/issues/351

/**
 * A parsed polymer binding expression
 * @param {Array.<string>} keys The keys referenced by this expression.
 * @param {Array.<string>} methods The methods referenced by this expression.
 * @param {string} type One of 'computed', 'literal', or 'reference'
 * @param {string} raw  The unparsed expression
 */
export class ParsedExpression {
  public keys: Array<string>;
  public methods: Array<string>;
  public type: string;
  public raw: string;
}

export interface Signature {
  method: string;
  static: boolean;
  args?: Argument[];
}

export interface Argument {
  name: string;
  value?: string|number;
  literal?: boolean;
  structured?: boolean;
  wildcard?: boolean;
}

function primaryName(expression: string): string {
  // TODO(usergenic): Remove this commented out section copied in from polylint
  // if (expression.name) {
  //   expression = expression.name;
  // }
  if (expression.match(/^('|").*('|")$/)) {  // string literal
    return '';
  }
  if (expression.match(/^-?\d*\.?\d+$/)) {  // number literal
    return '';
  }
  if (expression.indexOf('!') === 0) {
    return primaryName(expression.slice(1));
  }
  if (expression.indexOf('.') === -1) {
    return expression;
  } else {
    return expression.split('.')[0];
  }
}

export class ExpressionParser {
  public extractBindingExpression(text: string): string {
    const match = text.match(/\{\{(.*)\}\}/) || text.match(/\[\[(.*)\]\]/);
    if (match && match.length === 2) {
      let expression: string = match[1];
      if (expression.indexOf('::') > -1) {
        expression = expression.slice(0, expression.indexOf('::'));
      }
      return expression.trim();
    }
    return '';
  }

  public parseExpression(expression: string): ParsedExpression {
    const parsed = new ParsedExpression();
    parsed.raw = expression;

    const unwrapped = this.extractBindingExpression(expression);
    const parsedMethod = this._parseMethod(unwrapped);
    if (parsedMethod) {
      parsed.type = 'computed';
      parsed.keys = parsedMethod.args!.map((arg) => primaryName(arg.name));
      parsed.methods = [parsedMethod.method];
    } else {
      parsed.type = 'reference';
      parsed.methods = [];
      parsed.keys = [primaryName(unwrapped)];
    }
    return parsed;
  }

  private _parseMethod(expression: string): Signature|undefined {
    const m = expression.match(/(\w*)\((.*)\)/);
    if (m) {
      const sig: Signature = {method: m[1], static: true};
      if (m[2].trim()) {
        // replace escaped commas with comma entity, split on un-escaped commas
        const args = m[2].replace(/\\,/g, '&comma;').split(',');
        return this._parseArgs(args, sig);
      } else {
        sig.args = [];
        return sig;
      }
    }
  }

  private _parseArgs(argList: string[], sig: Signature): Signature {
    sig.args = argList.map((rawArg) => {
      const arg = this._parseArg(rawArg);
      if (!arg.literal) {
        sig.static = false;
      }
      return arg;
    });
    return sig;
  }

  private _parseArg(rawArg: string): Argument {
    // clean up whitespace
    const arg =
        rawArg
            .trim()
            // replace comma entity with comma
            .replace(/&comma;/g, ',')
            // repair extra escape sequences; note only commas strictly need
            // escaping, but we allow any other char to be escaped since its
            // likely users will do this
            .replace(/\\(.)/g, '\$1');
    // basic argument descriptor
    const a: Argument = {name: arg};
    // detect literal value (must be String or Number)
    let fc = arg[0];
    if (fc >= '0' && fc <= '9') {
      fc = '#';
    }
    switch (fc) {
      case '\'':
      case '"':
        a.value = arg.slice(1, -1);
        a.literal = true;
        break;
      case '#':
        a.value = Number(arg);
        a.literal = true;
        break;
      default:
        // no-op
    }
    // if not literal, look for structured path
    if (!a.literal) {
      // detect structured path (has dots)
      a.structured = arg.indexOf('.') > 0;
      if (a.structured) {
        a.wildcard = (arg.slice(-2) === '.*');
        if (a.wildcard) {
          a.name = arg.slice(0, -2);
        }
      }
    }
    return a;
  }
}
