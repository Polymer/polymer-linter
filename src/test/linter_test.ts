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
import * as assert from 'assert';
import {Document} from 'polymer-analyzer/lib/model/document';
import {Severity, Warning, WarningCarryingException} from 'polymer-analyzer/lib/warning/warning';
import {Linter} from '../linter';
import {Rule} from '../rule';

suite('Linter', () => {

  it('catches exceptions during Analyze and presents as Warnings', async() => {
    const explodingLinter = class implements Rule {
      public async check(document: Document): Promise<Warning[]> {
        throw new WarningCarryingException({
          code: 'exploding-linter-exploded',
          message: 'The exploding linter exploded.',
          severity: Severity.ERROR,
          sourceRange: {
            end: {column: 0, line: 0},
            file: document.url,
            start: {column: 0, line: 0}
          }
        });
      }
    };
    const linter = new Linter([new explodingLinter()]);
    const warnings =
        await linter.lint(['test/sample/my-element-collection.html']);
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0], {
      code: 'exploding-linter-exploded',
      message: 'The exploding linter exploded.',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 0, line: 0},
        file: 'test/sample/my-element-collection.html',
        start: {column: 0, line: 0}
      }
    });
  });
});
