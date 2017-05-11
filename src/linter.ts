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

import './collections';

import {Analyzer, comparePositionAndRange, Document, PolymerLintDirective, Severity, Warning, WarningCarryingException} from 'polymer-analyzer';

import {Rule} from './rule';

export {registry} from './registry';
export {Rule, RuleCollection} from './rule';

/**
 * Given a set of directives, return an array of only those directives that
 * apply to the given code. This can be a directive that mentions the rule by
 * name, or a directive that effects all rules.
 */
function filterDirectivesByCode(
    directives: Set<PolymerLintDirective>, code: string) {
  return Array.from(directives)
      .filter(
          (directive) => directive.args.length === 1 ||
              directive.args.slice(1).includes(code));
}

/**
 * Filter an array of warnings based on an ordered set of associated directives.
 * If a directive disables the rule at the location of the warning, that warning
 * will be filtered out as invalid.
 *
 * TODO(fks) 05-10-2017: Improve performance by first sorting warnings, and then
 * stepping through warnings and directives in lockstep in a single pass.
 */
function filterLintWarningsByDirective(
    warnings: Warning[], directives: Set<PolymerLintDirective>) {
  const directivesByCode = new Map<string, PolymerLintDirective[]>();
  return warnings.filter((warning: Warning) => {
    // Memoize the directives relevant to this specific warning code
    let relevantDirectives = directivesByCode.get(warning.code);
    if (!relevantDirectives) {
      relevantDirectives = filterDirectivesByCode(directives, warning.code);
      directivesByCode.set(warning.code, relevantDirectives);
    }
    // For each relevant directive that comes before the warning, flip the state
    // based on whether the directive was a "enable" or "disable" command.
    // Return the final state.
    return relevantDirectives.reduce((isValid, directive) => {
      const directiveEffect = (directive.args[0] === 'enable');
      const isDirectiveInSameFile =
          directive.sourceRange.file === warning.sourceRange.file;
      const isDirectiveBeforeWarning =
          comparePositionAndRange(
              directive.sourceRange!.end, warning.sourceRange) === -1;
      return (isDirectiveInSameFile && isDirectiveBeforeWarning) ?
          directiveEffect :
          isValid;
    }, true);
  });
}

/**
 * The Linter is a simple class which groups together a set of Rules and
 * applies them to a set of file urls which can be resolved and loaded by the
 * provided Analyzer.  A default Analyzer is prepared if one is not provided.
 */
export class Linter {
  private _analyzer: Analyzer;
  private _rules: Rule[];

  constructor(rules: Iterable<Rule>, analyzer: Analyzer) {
    this._analyzer = analyzer;
    this._rules = Array.from(rules);
  }

  /**
   * Given an array of filenames, lint the files and return an array of all
   * warnings produced evaluating the linter rules.
   */
  public async lint(files: string[]): Promise<Warning[]> {
    const {documents, warnings} = await this._analyzeAll(files);
    for (const document of documents) {
      warnings.push(...document.getWarnings());
    }
    return warnings.concat(...await this._lintDocuments(documents));
  }

  public async lintPackage(): Promise<Warning[]> {
    const pckage = await this._analyzer.analyzePackage();
    const warnings = pckage.getWarnings();
    warnings.push(
        ...await this._lintDocuments(pckage.getFeatures({kind: 'document'})));
    return warnings;
  }

  private async _lintDocuments(documents: Iterable<Document>) {
    const verifiedWarnings: Warning[] = [];
    for (const document of documents) {
      const lintWarnings: Warning[] = [];
      for (const rule of this._rules) {
        try {
          lintWarnings.push(...(await rule.check(document)));
        } catch (e) {
          verifiedWarnings.push(this._getWarningFromError(
              e,
              document.url,
              'internal-lint-error',
              `Internal error during linting: ${e ? e.message : e}`));
        }
      }
      const directives =
          document.getFeatures({kind: 'directive', id: 'polymer-lint'});
      if (directives.size === 0) {
        verifiedWarnings.push(...lintWarnings);
      } else {
        verifiedWarnings.push(
            ...filterLintWarningsByDirective(lintWarnings, directives));
      }
    }
    return verifiedWarnings;
  }

  private async _analyzeAll(files: string[]) {
    const analysis = await this._analyzer.analyze(files);
    const documents = [];
    const warnings = [];

    for (const file of files) {
      const result = analysis.getDocument(this._analyzer.resolveUrl(file));
      if (!result) {
        continue;
      } else if (result instanceof Document) {
        documents.push(result);
      } else {
        warnings.push(result);
      }
    }

    return {documents, warnings};
  }

  private _getWarningFromError(
      e: any, file: string, code: string, message: string) {
    if (e instanceof WarningCarryingException) {
      return e.warning;
    }
    return {
      code,
      message,
      severity: Severity.WARNING,
      sourceRange:
          {file, start: {line: 0, column: 0}, end: {line: 0, column: 0}}
    };
  }
}
