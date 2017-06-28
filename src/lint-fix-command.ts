#! /usr/bin/env node
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

import * as fs from 'fs';
import * as path from 'path';
import {Analyzer, FSUrlLoader, Document} from 'polymer-analyzer';

import {Linter, registry} from './linter';
import {applyEdits} from './warning';

async function main() {
  const analyzer = new Analyzer({urlLoader: new FSUrlLoader(process.cwd())});
  const rules = registry.getRules(['polymer-2']);
  const linter = new Linter(rules, analyzer);
  const files = process.argv.slice(2);
  const warnings = await linter.lint(files);
  const fixes = [];
  for (const warning of warnings) {
    if (warning.fix) {
      fixes.push(warning.fix);
    }
  }

  if (fixes.length === 0) {
    console.log('No fixes to apply.');
    return;
  }
  const loader = async(url: string) => {
    const analysis = await analyzer.analyze([url]);
    const result = analysis.getDocument(url);
    if (result && result instanceof Document) {
      return result.parsedDocument;
    }
    throw new Error(`Could not load ${url}`);
  };
  const {appliedEdits, incompatibleEdits, editedFiles} =
      await applyEdits(fixes, loader);
  if (editedFiles.size > 0) {
    console.log('Fixed:');
    for (const [fileName, contents] of editedFiles) {
      console.log(`  ${fileName}`);
      fs.writeFileSync(
          path.join(process.cwd(), fileName), contents, {encoding: 'utf-8'});
    }
    console.log('');
  }

  if (incompatibleEdits.length > 0) {
    console.log(
        `Fixed ${appliedEdits.length} warnings, ` +
        `${incompatibleEdits.length} had conflicts with other fixes. ` +
        `Rerun the command to apply them.`);
  } else {
    console.log(`Fixed ${appliedEdits.length} warnings.`);
  }
}

main()
    .catch(
        (err) => console.error(
            err ? err.stack || err.message || err : 'Unknown error.'));
