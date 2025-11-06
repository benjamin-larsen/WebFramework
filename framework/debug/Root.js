import { reactive } from '../reactivity/reactive.js';
import { createComponent, createElement } from '../vnode.js';

const ObjectPreview = {
  onCreated(ctx, props) {},

  render(ctx, props) {
    return [
      createElement(
        'div',
        { style: 'margin-left: 8px;' },
        Object.entries(props.obj).map(([key, val]) => {
          let type = typeof val;
          if (val === null) type = 'null';

          let formattedVal = null;

          switch (type) {
            case 'undefined':
            case 'null': {
              formattedVal = createElement(
                'span',
                { style: 'color: #1f52b3' },
                type
              );
              break;
            }

            case 'boolean': {
              formattedVal = createElement(
                'span',
                { style: 'color: #1f52b3' },
                type ? 'true' : 'false'
              );
              break;
            }

            case 'number': {
              formattedVal = createElement(
                'span',
                { style: 'color: #88a71a' },
                val.toString()
              );
              break;
            }

            case 'bigint': {
              formattedVal = createElement(
                'span',
                { style: 'color: #88a71a' },
                `${val.toString()}n`
              );
              break;
            }

            case 'string': {
              formattedVal = createElement(
                'span',
                { style: 'color: #c3915e' },
                JSON.stringify(val)
              );
              break;
            }

            case 'symbol': {
              formattedVal = createElement(
                'span',
                { style: 'color: #c9ac09ff' },
                val.toString()
              );
              break;
            }

            case 'object': {
              formattedVal = createComponent(ObjectPreview, { obj: val }, null);
              break;
            }
          }

          return createElement(
            'div',
            {},
            createElement('span', { style: 'margin-right: 5px' }, `${key}:`),
            formattedVal
          );
        })
      )
    ];
  }
};

const objTest = reactive({
  a: undefined,
  b: null,
  c: true,
  d: 1.5,
  e: 5n,
  str: 'hi',
  sym: Symbol('hi'),
  func: () => {},
  obj: { a: 'hi', b: 'test' },
  arr: ['hi']
});

export default {
  render() {
    return [
      createElement('div', null, 'Debugger'),
      createComponent(ObjectPreview, { obj: objTest }, null)
    ];
  }
};
