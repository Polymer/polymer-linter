# Polymer Linter

Analyze your Polymer project for errors.

## Usage

The linter can be run in one of two ways, from the command line, or through our editor plugins.

First though, it needs to be configured. Create a `polymer.json` file at the root of your project and ensure it has a "lint" field like so:

```json
{
  "lint": {
    "rules": ["polymer-2-hybrid"]
  }
}
```

You can specify either individual rules, or rule collections. See `polymer lint --help` for a full listing, or see [collections.ts](src/collections.ts) for details.

### From the command line

polymer-lint is run on the command line through Polymer CLI:

```
  npm install -g polymer-cli@next
  cd my-project
  polymer lint
```

```
    <paper-button opan="{{nonono}}"></paper-button>
                  ~~~~

my-elem.html(9,24) warning [set-unknown-attribute] - paper-button elements do not have a property named opan. Consider instead:  open
```

### Inside your editor

polymer-lint is also integrated into a number of editor plugins for instant as-you-type linting. See [https://github.com/Polymer/polymer-editor-service](the polymer editor service) for details.

<!-- TODO(rictic): animated gif of editing text with linting here. -->

## Writing your own lint rule

The linter is built on top of the [polymer analyzer](https://github.com/Polymer/polymer-analyzer). A lint rule is given a `Document` object with an AST that can be walked, as well as the ability to query high level features of the document like imports and custom elements. From this is just has to return an array of warnings to display.

For a simple example, see [behaviors-spelling](src/polymer/behaviors-spelling.ts), which implements checks for the commonwealth spelling of the property `behaviors` on a Polymer element.

You'll then need to import your rule from [rules.ts](src/rules.ts), and you'll probably want to add your rule to one or more [rule collections](src/collections.ts).

### Testing

Testing is straightforward and robust. Test code is in `src/test` and fixtures live in `test/`. We have facilities for ensuring that your warnings pinpoint the issue to the exact right section of code, as well as ensuring that your rule was registered correctly.

See [behaviors-spelling_test.ts](src/test/polymer/behaviors-spelling_test.ts) for an example.

### Help writing lint rules

More lint rules are very much welcome! We're happy to answer questions. We've got a very welcoming community, come join us in the [#tools channel on slack](https://polymer.slack.com/messages/tools)! ([invites emailed automatically here](https://polymer-slack.herokuapp.com/))

## Previous Version

Polymer Linter is the successor to [polylint](https://www.github.com/polymerlabs/polylint).

