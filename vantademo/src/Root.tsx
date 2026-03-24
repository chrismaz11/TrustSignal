import React from "react";
import {Composition} from "remotion";
import {Main} from "./Main";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TrustSignalTerminalDemo"
        component={Main}
        durationInFrames={1200}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
