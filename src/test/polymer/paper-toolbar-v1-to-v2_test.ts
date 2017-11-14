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
import {Analyzer, FSUrlLoader} from 'polymer-analyzer';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {applyEdits, makeParseLoader} from '../../warning';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

const ruleId = 'paper-toolbar-v1-to-v2';

suite(ruleId, () => {
  let analyzer: Analyzer;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  test('Child elements without slots or a special class have `slot="top"` added.',
    async() => {
      const warnings = await linter.lint([`${ruleId}/child-default-slot_before.html`]);
      const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
      const loader = makeParseLoader(analyzer);
      const result = await applyEdits(edits, loader);
      assert.deepEqual(
          result.editedFiles.get(`${ruleId}/child-default-slot_before.html`),
          (await loader(`${ruleId}/child-default-slot_after.html`)).contents);
    });

  test('Child elements with the "middle" class have `slot="middle"` added.',
    async() => {
      const warnings = await linter.lint([`${ruleId}/child-middle-slot_before.html`]);
      const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
      const loader = makeParseLoader(analyzer);
      const result = await applyEdits(edits, loader);
      assert.deepEqual(
          result.editedFiles.get(`${ruleId}/child-middle-slot_before.html`),
          (await loader(`${ruleId}/child-middle-slot_after.html`)).contents);
    });

  test('Child elements with the "bottom" class have `slot="bottom"` added.',
    async() => {
      const warnings = await linter.lint([`${ruleId}/child-bottom-slot_before.html`]);
      const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
      const loader = makeParseLoader(analyzer);
      const result = await applyEdits(edits, loader);
      assert.deepEqual(
          result.editedFiles.get(`${ruleId}/child-bottom-slot_before.html`),
          (await loader(`${ruleId}/child-bottom-slot_after.html`)).contents);
    });

    test('Child text nodes that are not completely whitespace are wrapped in a ' +
      'div with `slot="top"`.', async() => {
        const warnings = await linter.lint([`${ruleId}/child-non-whitespace-text_before.html`]);
        const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
        const loader = makeParseLoader(analyzer);
        const result = await applyEdits(edits, loader);
        assert.deepEqual(
            result.editedFiles.get(`${ruleId}/child-non-whitespace-text_before.html`),
            (await loader(`${ruleId}/child-non-whitespace-text_after.html`)).contents);
      });
});
