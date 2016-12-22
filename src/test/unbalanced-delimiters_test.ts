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
import {Severity, Warning} from 'polymer-analyzer/lib/warning/warning';

import {Linter} from '../linter';
import {UnbalancedDelimiters} from '../rules/unbalanced-delimiters';

suite('UnbalancedDelimiters', () => {

  test('unbalanced-delimiters', async() => {

    const linter: Linter = new Linter([new UnbalancedDelimiters()]);
    const warnings: Warning[] =
        (await linter.lint(['test/sample/imports/unbalanced-delimiters.html']))
            .filter((warning) => warning.code === 'unbalanced-delimiters');

    assert.equal(warnings.length, 6);

    assert.deepEqual(warnings[0], {
      code: 'unbalanced-delimiters',
      message: 'Invalid polymer expression delimiters.  You put \'[[]\' ' +
          'are you missing a closing \']\'?',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 18, line: 11},
        file: 'test/sample/imports/unbalanced-delimiters.html',
        start: {column: 10, line: 11}
      }
    });

    assert.deepEqual(warnings[1], {
      code: 'unbalanced-delimiters',
      message: 'Invalid polymer expression delimiters.  You put \'[]]\' ' +
          'are you missing an opening \'[\'?',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 18, line: 12},
        file: 'test/sample/imports/unbalanced-delimiters.html',
        start: {column: 10, line: 12}
      }
    });

    assert.deepEqual(warnings[2], {
      code: 'unbalanced-delimiters',
      message: 'Invalid polymer expression delimiters.  You put \'{}}\' ' +
          'are you missing an opening \'{\'?',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 18, line: 13},
        file: 'test/sample/imports/unbalanced-delimiters.html',
        start: {column: 10, line: 13}
      }
    });

    assert.deepEqual(warnings[3], {
      code: 'unbalanced-delimiters',
      message: 'Invalid polymer expression delimiters.  You put \'{{}\' ' +
          'are you missing a closing \'}\'?',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 18, line: 14},
        file: 'test/sample/imports/unbalanced-delimiters.html',
        start: {column: 10, line: 14}
      }
    });

    assert.deepEqual(warnings[4], {
      code: 'unbalanced-delimiters',
      message: 'Invalid polymer expression delimiters.  You put \'{{}\' ' +
          'are you missing a closing \'}\'?',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 5, line: 17},
        file: 'test/sample/imports/unbalanced-delimiters.html',
        start: {column: 10, line: 15}
      }
    });

    assert.deepEqual(warnings[5], {
      code: 'unbalanced-delimiters',
      message: 'Invalid polymer expression delimiters.  You put \'{{}\' ' +
          'are you missing a closing \'}\'?',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 22, line: 18},
        file: 'test/sample/imports/unbalanced-delimiters.html',
        start: {column: 12, line: 18}
      }
    });
  });
});
