import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { GuideDocument, type GuideProps } from './GuideDocument';

export async function renderGuidePdf(props: GuideProps): Promise<Buffer> {
  return renderToBuffer(createElement(GuideDocument, props) as never);
}
