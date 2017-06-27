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

import {Document} from 'polymer-analyzer';
import {FixableWarning} from './warning';

/**
 * A lint rule. Can take a package and find Warnings.
 */
export abstract class Rule {
  /**
   * A unique identifier for this lint rule, like "move-style-into-template".
   */
  abstract code: string;

  /**
   * A description of this lint rule. Like "Warns for style
   * children of dom-modules outside of template tags."
   */
  abstract description: string;

  /**
   * Finds all warnings in the given document.
   */
  abstract check(document: Document): Promise<FixableWarning[]>;
}

/**
 * A named collection of lint rules. Useful for building collections of rules,
 * like rules that note problems that may arise upgrading from Polymer 1.0 to
 * 2.0.
 */
export class RuleCollection {
  /**
   * A unique string identifying this collection. Uses the same namespace as
   * Rules.
   */
  code: string;

  /**
   * Describes the rule collection.
   *
   * A description should answer questions like: Who should use it? When? What
   * should they expect?
   */
  description: string;

  /**
   * A list of codes that identify the rules in this collection.
   *
   * The codes can identify rules or rule collections.
   */
  rules: string[];

  constructor(code: string, description: string, rules: string[]) {
    this.code = code;
    this.description = description;
    this.rules = rules;
  }
}
