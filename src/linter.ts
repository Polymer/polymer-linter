/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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
import {Analyzer} from 'polymer-analyzer';
import {Document} from 'polymer-analyzer/lib/model/document';
import {FSUrlLoader} from 'polymer-analyzer/lib/url-loader/fs-url-loader';
import {Warning, WarningCarryingException} from 'polymer-analyzer/lib/warning/warning';
import {Rule} from './rule';

/**
 * The Linter is a simple class which groups together a set of Rules and applies
 * them to a set of file urls which can be resolved and loaded by the provided
 * Analyzer.  A default Analyzer is prepared if one is not provided.
 */
export class Linter {
  public analyzer: Analyzer;
  public rules: Rule[];

  constructor(rules: Rule[], analyzer?: Analyzer) {
    this.analyzer = analyzer || new Analyzer({urlLoader: new FSUrlLoader()});
    this.rules = Array.from(rules);
  }

  /**
   * Given an array of filenames, lint the files and return an array of all
   * warnings produced evaluating the linter rules.
   */
  public async lint(files: string[]): Promise<Warning[]> {
    let warnings: Warning[] = [];
    for (const file of files) {
      let document: Document;
      try {
        document = await this.analyzer.analyze(file);
        for (const rule of this.rules) {
          warnings = warnings.concat(await rule.check(document));
        }
      } catch (error) {
        if (error instanceof WarningCarryingException) {
          warnings.push(error.warning);
          continue;
        }
        throw error;
      }
    }
    return warnings;
  }
}
