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
import {Analyzer} from 'polymer-analyzer';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {assertExpectedFixes, WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');
const ruleId = `content-to-slotted-usages`;

suite.only(ruleId, () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = Analyzer.createForDirectory(fixtures_dir);
    warningPrinter = new WarningPrettyPrinter();
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  test('works in the trivial case', async() => {
    const {warnings} = await linter.lint([]);
    assert.deepEqual([...warnings], []);
  });

  test('gives no warnings for a perfectly fine file', async() => {
    const {warnings} =
        await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual([...warnings], []);
  });

  test('warns for the proper cases and with the right messages', async() => {
    const {warnings} = await linter.lint([`${ruleId}/${ruleId}.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
  `
  ::content h1 {
  ~~~~~~~~~`,
  `
  ::content::before {
  ~~~~~~~~~`,    
  `
  x-tabs ::content x-panel {
         ~~~~~~~~~`,
    `
    :host ::content > [top-item] {
          ~~~~~~~~~`,
    `
    ::content > [top-item] {
    ~~~~~~~~~`,
    `
    ::content * {
    ~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `The ::content pseudo-element has been deprecated in favor of the ::shadow psuedo-element in WebComponents v1.`,
      `The ::content pseudo-element has been deprecated in favor of the ::shadow psuedo-element in WebComponents v1.`,
      `The ::content pseudo-element has been deprecated in favor of the ::shadow psuedo-element in WebComponents v1.`,
      `The ::content pseudo-element has been deprecated in favor of the ::shadow psuedo-element in WebComponents v1.`,
      `The ::content pseudo-element has been deprecated in favor of the ::shadow psuedo-element in WebComponents v1.`,
      `The ::content pseudo-element has been deprecated in favor of the ::shadow psuedo-element in WebComponents v1.`,
    ]);
  });

  test('applies automatic-safe fixes', async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/before-fixes.html`,
        `${ruleId}/after-fixes.html`);
  });
});
