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
import {Warning, WarningCarryingException, Severity} from 'polymer-analyzer/lib/warning/warning';
import {Rule} from './rule';

/**
 * The Linter is a simple class which groups together a set of Rules and applies
 * them to a set of file urls which can be resolved and loaded by the provided
 * Analyzer.  A default Analyzer is prepared if one is not provided.
 */
export class Linter {
  private _analyzer: Analyzer;
  private _rules: Rule[];

  constructor(rules: Rule[], analyzer: Analyzer) {
    this._analyzer = analyzer;
    this._rules = Array.from(rules);
  }

  /**
   * Given an array of filenames, lint the files and return an array of all
   * warnings produced evaluating the linter rules.
   */
  public async lint(files: string[]): Promise<Warning[]> {
    let warnings: Warning[] = [];
    const analysisResult = await this._analyzeAll(files);
    const documents = analysisResult.documents;
    const analysisWarnings = analysisResult.warnings;
    warnings = warnings.concat(analysisWarnings);
    for (const document of documents) {
      for (const rule of this._rules) {
        warnings = warnings.concat(await rule.check(document));
      }
    }
    return warnings;
  }

  private async _analyzeAll(files: string[]) {
    const documents = [];
    const warnings: Warning[] = [];
    for (const file of files) {
      try {
        documents.push(await this._analyzer.analyze(file));
      } catch (e) {
        if (e instanceof WarningCarryingException) {
          warnings.push(e.warning);
        } else {
          warnings.push({
            code: 'unable-to-analyze-file',
            message: `Internal Error while analyzing: ${e ? e.message : e}`,
            severity: Severity.WARNING,
            sourceRange: {
              file,
              start: {line: 0, column: 0},
              end: {line: 0, column: 0}
            }
          });
        }
      }
    }

    return {documents, warnings};
  }
}
