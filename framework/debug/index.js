import { App } from '../index.js';
import { root } from '../vnode.js';
import Root from './Root.js';

export default function (ctx) {
  const app = new App(root(Root, document.body));
  app.render();

  ctx.enableRenderTiming();
}
