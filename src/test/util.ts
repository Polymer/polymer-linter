/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {assert} from 'chai';
import {Analyzer, applyEdits, EditResult, makeParseLoader, Warning} from 'polymer-analyzer';

import {Linter} from '../linter';

export class WarningPrettyPrinter {
  prettyPrint(warnings: ReadonlyArray<Warning>): string[] {
    return warnings.map(
        (w) => '\n' + w.toString({verbosity: 'code-only', color: false}));
  }
}

export async function assertExpectedFixes(
    linter: Linter, analyzer: Analyzer, inputFile: string, outputFile: string) {
  const warnings = await linter.lint([inputFile]);
  const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
  const loader = makeParseLoader(analyzer);
  const result = await applyEdits(edits, loader);
  const inputFileContent =
      result.editedFiles.get(analyzer.resolveUrl(inputFile)!);
  const outputFileContent =
      (await loader(analyzer.resolveUrl(outputFile)!)).contents;
  assert.deepEqual(inputFileContent, outputFileContent);
}

export async function assertFileEdited(
    analyzer: Analyzer, editResult: EditResult, before: string, after: string) {
  assert.deepEqual(
      editResult.editedFiles.get(analyzer.resolveUrl(before)!),
      (await analyzer.load(analyzer.resolveUrl(after)!)));
}
