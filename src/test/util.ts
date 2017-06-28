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

import {Analyzer, Document, ParsedDocument, Warning, WarningPrinter} from 'polymer-analyzer';

export class WarningPrettyPrinter {
  private _printer: WarningPrinter;
  constructor() {
    this._printer = new WarningPrinter(null as any);
  }

  prettyPrint(warnings: Warning[]): string[] {
    return warnings.map(
        (w) => '\n' + w.toString({verbosity: 'code-only', color: false}));
  }
}

export function parsedLoaderFromAnalyzer(analyzer: Analyzer): (url: string) =>
    Promise<ParsedDocument<any, any>> {
  return async(url: string) => {
    const result = (await analyzer.analyze([url])).getDocument(url);
    if (!(result instanceof Document)) {
      throw new Error('expected a result');
    }
    return result.parsedDocument;
  };
}
