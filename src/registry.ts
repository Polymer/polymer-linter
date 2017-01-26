/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {Rule, RuleCollection} from './rule';
import {stripWhitespace} from './util';

/**
 * A singleton class where lint rules and rule collections can register
 * themselves and you can get a collection of rules by querying.
 */
export class LintRegistry {
  private static readonly _singleton = new LintRegistry();
  static get instance() {
    return LintRegistry._singleton;
  }

  private _all = new Map<string, Rule|RuleCollection>();

  private constructor() {
  }

  /**
   * Register the given rule or collection so that it can be later retrieved.
   */
  register(rule: Rule|RuleCollection) {
    const existing = this._all.get(rule.code);
    if (existing) {
      throw new Error(stripWhitespace(`
          Attempted to register more than one rule / rule collection with
          code '${rule.code}'. Existing rule:
          ${existing.constructor}, new rule: ${rule.constructor}`));
    }
    if (rule instanceof RuleCollection) {
      // Ensure that its rules all exist.
      this.getRules(rule.rules);
    }
    this._all.set(rule.code, rule);
  }

  /**
   * Given an array of string codes for registered rules and rule collections,
   * return the set of rules.
   */
  getRules(ruleCodes: string[]): Set<Rule> {
    return this._getRules(ruleCodes, new Set());
  }

  private _getRules(ruleCodes: string[], alreadyExpanded: Set<string>):
      Set<Rule> {
    ruleCodes = ruleCodes.filter(p => !alreadyExpanded.has(p));

    const results = new Set<Rule>();

    for (const code of ruleCodes) {
      for (const rule of this._getRulesForCode(code, alreadyExpanded)) {
        results.add(rule);
      }
    }

    return results;
  }

  private _getRulesForCode(code: string, alreadyExpanded: Set<string>) {
    alreadyExpanded.add(code);
    const ruleOrCollection = this._all.get(code);
    if (ruleOrCollection == null) {
      throw new Error(`Could not find lint rule with code '${code}'`);
    }

    if (ruleOrCollection instanceof Rule) {
      return new Set([ruleOrCollection]);
    }

    return this._getRules(ruleOrCollection.rules, alreadyExpanded);
  }
}

export const registry = LintRegistry.instance;
