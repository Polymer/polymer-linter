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
import * as assert from 'assert';

import {Linter} from '../linter';
import {UndefinedElements} from '../rules/undefined-elements';

suite('UndefinedElements', () => {

  test('finds undefined element references', async() => {
    const linter = new Linter([new UndefinedElements()]);
    const warnings = await linter.lint(['test/sample/undefined-elements.html']);

    assert.deepEqual(warnings, {});
  });
});
