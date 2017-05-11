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
import * as path from 'path';
import {Analyzer, Document, FSUrlLoader, Severity, Warning} from 'polymer-analyzer';

import {Linter} from '../linter';
import {registry} from '../registry';
import {Rule} from '../rule';

import {WarningPrettyPrinter} from './util';

const fixtures_dir = path.resolve(path.join(__dirname, '../../test'));

class AlwaysWarnsRule extends Rule {
  code = 'always-warn-rule';
  description: 'Always warns, for every file';
  async check(document: Document): Promise<Warning[]> {
    return [{
      code: this.code,
      message: this.description,
      severity: Severity.WARNING,
      sourceRange: {
        file: document.url,
        start: {line: 0, column: 0},
        end: {line: 0, column: 0}
      }
    }];
  }
}

suite('Linter', () => {

  suite('.lint', () => {
    let analyzer: Analyzer;
    let warningPrinter: WarningPrettyPrinter;

    setup(() => {
      analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
      warningPrinter = new WarningPrettyPrinter(analyzer);
    });

    test('works in the trivial case', async() => {
      const linter = new Linter([], analyzer);
      const warnings = await linter.lint([]);
      assert.deepEqual(warnings, []);
    });

    test('gives no warnings for a perfectly fine file', async() => {
      const linter = new Linter([], analyzer);
      const warnings =
          await linter.lint(['perfectly-fine/polymer-element.html']);
      assert.deepEqual(warnings, []);
    });

    test('surfaces warnings up from the analyzer', async() => {
      // Even without any rules we still get the warnings from the analyzer.
      const linter = new Linter([], analyzer);
      const warnings =
          await linter.lint(['missing-imports/missing-imports.html']);
      assert.deepEqual(await warningPrinter.prettyPrint(warnings), [
        `
<link rel="import" href="./does-not-exist.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~`,
        `
<link rel="import" href="./also-does-not-exist.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
      ]);
    });

    const testName =
        'when linting a package, do not surface warnings from external files';
    test(testName, async() => {
      const analyzer = new Analyzer({
        urlLoader: new FSUrlLoader(path.join(fixtures_dir, 'package-external'))
      });
      const linter = new Linter([new AlwaysWarnsRule()], analyzer);
      const warnings = await linter.lintPackage();
      // One warning from the analyzer, one from the AlwaysWarns, both in index,
      // none from bower_components/external.html
      assert.deepEqual(
          warnings.map((w) => w.sourceRange.file),
          ['index.html', 'index.html']);

      const alsoWarnings = await linter.lint(['index.html']);
      assert.deepEqual(alsoWarnings, warnings);

      const allWarnings =
          await linter.lint(['index.html', 'bower_components/external.html']);
      assert.deepEqual(allWarnings.map((w) => w.sourceRange.file).sort(), [
        'index.html',
        'index.html',
        'bower_components/external.html',
        'bower_components/external.html'
      ].sort());
    });

    suite('comment directives', () => {

      (<[[string, any]]>[
        ['comment-directives/disable-all.html', []],
        [
          'comment-directives/disable-one.html',
          [{
            code: 'behaviors-spelling',
            sourceRange: {
              file: 'comment-directives/disable-one.html',
              start: {line: 8, column: 4},
              end: {line: 8, column: 18}
            }
          }]
        ],
        [
          'comment-directives/disable-all-then-renable-one.html',
          [{
            code: 'dom-module-invalid-attrs',
            sourceRange: {
              file: 'comment-directives/disable-all-then-renable-one.html',
              start: {line: 4, column: 12},
              end: {line: 4, column: 16}
            }
          }]
        ],
        [
          'comment-directives/disable-all-then-renable-all.html',
          [{
            code: 'dom-module-invalid-attrs',
            sourceRange: {
              file: 'comment-directives/disable-all-then-renable-all.html',
              start: {line: 4, column: 12},
              end: {line: 4, column: 16}
            }
          }]

        ],
        [
          'comment-directives/disable-one-then-renable-one.html',
          [{
            code: 'dom-module-invalid-attrs',
            sourceRange: {
              file: 'comment-directives/disable-one-then-renable-one.html',
              start: {line: 4, column: 12},
              end: {line: 4, column: 16}
            }
          }]
        ],
        [
          'comment-directives/disable-one-then-renable-all.html',
          [{
            code: 'dom-module-invalid-attrs',
            sourceRange: {
              file: 'comment-directives/disable-one-then-renable-all.html',
              start: {line: 4, column: 12},
              end: {line: 4, column: 16}
            }
          }]
        ],
        ['comment-directives/inline-documents-inherit.html', []],
        [
          'comment-directives/inline-documents-interweave.html',
          [
            {
              code: 'dom-module-invalid-attrs',
              sourceRange: {
                file: 'comment-directives/inline-documents-interweave.html',
                start: {line: 23, column: 12},
                end: {line: 23, column: 16}
              }
            },
            {
              code: 'behaviors-spelling',
              sourceRange: {
                file: 'comment-directives/inline-documents-interweave.html',
                start: {line: 17, column: 4},
                end: {line: 17, column: 18}
              }
            }
          ]
        ],
      ]).forEach(([filePath, expectedResults]) => {
        test(`properly lints ${filePath}`, async() => {
          const linter = new Linter(
              registry.getRules(
                  ['dom-module-invalid-attrs', 'behaviors-spelling']),
              analyzer);
          const warnings = await linter.lint([filePath]);
          const warningsData =
              warnings.map(({code, sourceRange}) => ({code, sourceRange}));
          assert.deepEqual(warningsData, expectedResults);
        });
      });
    });
  });
});
