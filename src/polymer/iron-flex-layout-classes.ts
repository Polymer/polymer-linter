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

import * as dom5 from 'dom5';
import {treeAdapters} from 'parse5';
import {Document, ParsedHtmlDocument, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {FixableWarning} from '../warning';

import stripIndent = require('strip-indent');

import cssWhat = require('css-what');

const p = dom5.predicates;

const deprecatedImport = 'iron-flex-layout/classes/iron-flex-layout.html';
const replacementImport = 'iron-flex-layout/iron-flex-layout-classes.html';

const validModules = {
  'iron-flex': elementSelectorToPredicate('.layout.horizontal, .layout.vertical, .layout.inline, .layout.wrap, .layout.no-wrap, .layout.center, .layout.center-center, .layout.center-justified, .flex, .flex-auto, .flex-none'),
  'iron-flex-reverse': elementSelectorToPredicate('.layout.horizontal-reverse, .layout.vertical-reverse, .layout.wrap-reverse'),
  'iron-flex-alignment': elementSelectorToPredicate('.layout.start, .layout.center, .layout.center-center, .layout.end, .layout.baseline, .layout.start-justified, .layout.center-justified, .layout.center-center, .layout.end-justified, .layout.around-justified, .layout.justified, .self-start, .self-center, .self-end, .self-stretch, .self-baseline, .layout.start-aligned, .layout.end-aligned, .layout.center-aligned, .layout.between-aligned, .layout.around-aligned'),
  'iron-flex-factors': elementSelectorToPredicate('.flex-1, .flex-2, .flex-3, .flex-4, .flex-5, .flex-6, .flex-7, .flex-8, .flex-9, .flex-10, .flex-11, .flex-12'),
  'iron-positioning': elementSelectorToPredicate('.block, [hidden], .invisible, .relative, .fit, body.fullbleed, .scroll, .fixed-bottom, .fixed-left, .fixed-top, .fixed-right'),
};
const flexLayoutClassesSelector = p.OR(...Object.values(validModules));
const flexLayoutModules = 'iron-flex iron-flex-reverse iron-flex-alignment iron-flex-factors iron-positioning';


class IronFlexLayoutClasses extends HtmlRule {
  code = 'iron-flex-layout-classes';
  description = stripIndent(`
      Warns when classes/iron-flex-layout.html is not needed.
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    // 1. replace import classes/iron-(shadow-)flex-layout.html with iron-flex-layout.html
    // 2. check if uses any of the style classes
    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
      parsedDocument: ParsedHtmlDocument, document: Document,
      warnings: FixableWarning[]) {
    const imports = document.getFeatures({ kind: 'import' });
    for (const imp of imports) {
      const node = imp.astNode;
      // 1. look if it imports classes/iron-flex-layout.html
      const href = dom5.getAttribute(node, 'href');
      if (!href || !href.endsWith(deprecatedImport)) {
        continue;
      }
      // 2. look if it uses the classes in the template.
      const hrefRange = parsedDocument.sourceRangeForAttributeValue(node, 'href')!;
      const modules = modulesUsingFlexLayoutClasses(document);
      if (modules.length) {
        // Replace import with the correct one.
        const fix = [];
        fix.push({
          // excludeQuotes = true returns a range that is 1 index too big, so include the quotes
          // in the range and in the replacement text.
          replacementText: `"${href.replace(deprecatedImport, replacementImport)}"`,
          range: hrefRange
        });
        // Update style include for each module
        for (const domModule of modules) {
          const template = dom5.query(domModule, p.hasTagName('template'))!;
          let styleNode = dom5.query(
            treeAdapters.default.getTemplateContent(template),
            p.hasTagName('style'));
          if (styleNode) {
            if (dom5.hasAttribute(styleNode, 'include')) {
              const includesAttr = dom5.getAttribute(styleNode, 'include')!;
              fix.push({
                replacementText: `"${includesAttr} ${flexLayoutModules}"`,
                range: parsedDocument.sourceRangeForAttributeValue(styleNode, 'include')!
              });
            } else {
              const tagRange = parsedDocument.sourceRangeForStartTag(styleNode)!;
              fix.push({
                replacementText: ` include="${flexLayoutModules}"`,
                range: {
                  file: tagRange.file,
                  start: { line: tagRange.end.line, column: tagRange.end.column - 1 },
                  end: { line: tagRange.end.line, column: tagRange.end.column - 1 }
                }
              });
            }
          } else {
            const tagRange = parsedDocument.sourceRangeForStartTag(template)!;
            // TODO(valdrin): indent properly would be nice...
            fix.push({
              replacementText: `\n<style include="${flexLayoutModules}"></style>`,
              range: {
                file: tagRange.file,
                start: { line: tagRange.end.line, column: tagRange.end.column },
                end: { line: tagRange.end.line, column: tagRange.end.column }
              }
            });
          }
        }
        // TODO(valdrin) go through all the dependencies to see if they need the same fixes.
        const warning = new FixableWarning({
          code: 'iron-flex-layout-classes',
          message:
              `${deprecatedImport} import is deprecated. ` +
              `Replace with ${replacementImport} import.`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange: hrefRange
        });
        warning.fix = fix;
        warnings.push(warning);
      } else {
        // Suggest to remove the import as it's not used.
        const warning = new FixableWarning({
          code: 'iron-flex-layout-classes',
          message:
              `Remove ${deprecatedImport} import as it's deprecated ` +
              `and not used in this module.`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange: hrefRange
        });
        // TODO implement fix that removes the import.
        warnings.push(warning);
      }
    }
  }
}

/**
 * Looks for dom-modules that use iron-flex-layout classes (e.g. <div class="layout horizontal">)
 */
function modulesUsingFlexLayoutClasses(document: Document) {
  const modules: dom5.Node[] = [];
  for (const element of document.getFeatures({ kind: 'polymer-element' })) {
    const domModule = element.domModule;
    if (!domModule) {
      continue;
    }
    const template = dom5.query(domModule, p.hasTagName('template'));
    if (!template) {
      continue;
    }
    if (dom5.query(
          treeAdapters.default.getTemplateContent(template),
          flexLayoutClassesSelector)) {
      modules.push(domModule);
    }
  }
  return modules;
}

/**
 * Looks for dom-modules that use iron-flex-layout classes (e.g. <div class="layout horizontal">) without
 * including the required styles via <style include=""></style>.
 */
// function modulesRequiringStyleIncludes(document: Document) {
//   const modules: dom5.Node[] = [];
//   for (const element of document.getFeatures({ kind: 'polymer-element' })) {
//     const domModule = element.domModule;
//     if (!domModule) {
//       continue;
//     }
//     const template = dom5.query(domModule, p.hasTagName('template'));
//     if (!template) {
//       continue;
//     }
//     const templateContent = treeAdapters.default.getTemplateContent(template);
//     const styleNode = dom5.query(templateContent, p.hasTagName('style'));
//     const styleInclude = styleNode ? dom5.getAttribute(styleNode, 'include') || '' : '';
//     const styleModulesToInclude = [];
//     for (const module in validModules) {
//       if (styleInclude.indexOf(module) === -1 &&
//         dom5.query(templateContent, validModules[module])) {
//         styleModulesToInclude.push(module);
//       }
//     }
//     if (styleModulesToInclude.length) {
//       modules.push(domModule);
//     }
//   }
//   return modules;
// }


// TODO(valdrin) move this in commons or something.
/* ---- START copy-pasted from content-to-slot-usages. --- */
function elementSelectorToPredicate(simpleSelector: string): dom5.Predicate {
  const parsed = cssWhat(simpleSelector);
  // The output of cssWhat is two levels of arrays. The outer level are any
  // selectors joined with a comma, so it matches if any of the inner selectors
  // match. The inner array are simple selectors like `.foo` and `#bar` which
  // must all match.
  return dom5.predicates.OR(...parsed.map((simpleSelectors) => {
    return dom5.predicates.AND(
        ...simpleSelectors.map(simpleSelectorToPredicate));
  }));
}

function simpleSelectorToPredicate(selector: cssWhat.Simple) {
  switch (selector.type) {
    case 'adjacent':
    case 'child':
    case 'descendant':
    case 'parent':
    case 'sibling':
    case 'pseudo':
      throw new Error(`Unsupported CSS operator: ${selector.type}`);
    case 'attribute':
      return attributeSelectorToPredicate(selector);
    case 'tag':
      return dom5.predicates.hasTagName(selector.name);
    case 'universal':
      return () => true;
  }
  const never: never = selector;
  throw new Error(`Unexpected node type from css parser: ${never}`);
}

function attributeSelectorToPredicate(selector: cssWhat.Attribute):
    dom5.Predicate {
  switch (selector.action) {
    case 'exists':
      return dom5.predicates.hasAttr(selector.name);
    case 'equals':
      return dom5.predicates.hasAttrValue(selector.name, selector.value);
    case 'start':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.startsWith(selector.value);
      };
    case 'end':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.endsWith(selector.value);
      };
    case 'element':
      return dom5.predicates.hasSpaceSeparatedAttrValue(
          selector.name, selector.value);
    case 'any':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.includes(selector.value);
      };
  }
  const never: never = selector.action;
  throw new Error(
      `Unexpected type of attribute matcher from CSS parser ${never}`);
}
/* ---- END copy-paste from content-to-slot-usages. --- */

registry.register(new IronFlexLayoutClasses());
