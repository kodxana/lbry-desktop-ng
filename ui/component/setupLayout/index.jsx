// @flow
import React from 'react';
import type { Node } from 'react';
// $FlowFixMe cannot resolve asset imports
import YrblHappy from 'static/img/yrblhappy.svg';

type Props = { children: Node };

// Use the same columns and illustration as Welcome, Privacy and Hosting.
export default function SetupLayout({ children }: Props): React.Node {
  return (
    <main className="setup-layout" theme="dark">
      <section className="main--contained">
        <div className="columns first-run__wrapper">
          <div className="first-run__left">{children}</div>
          <div className="first-run__image-wrapper">
            <img src={YrblHappy} className="privacy-img" alt="" />
          </div>
        </div>
      </section>
    </main>
  );
}
