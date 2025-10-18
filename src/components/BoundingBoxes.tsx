import React from "react";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DetectedObject {
  box: Box;
  label: string;
  confidence: number;
}

interface BoundingBoxesProps {
  objects: DetectedObject[];
}

const BoundingBoxes: React.FC<BoundingBoxesProps> = ({ objects }) => {
  if (!objects || objects.length === 0) return null;

  return (
    <>
      {objects.map((obj, idx) => (
        <div
          key={idx}
          role="img"
          aria-label={`${obj.label} detected`}
          className="bounding-box"
          style={{
            left: `${obj.box.x * 100}%`,
            top: `${obj.box.y * 100}%`,
            width: `${obj.box.w * 100}%`,
            height: `${obj.box.h * 100}%`,
          }}
        >
          <span className="bounding-label">
            {obj.label} {(obj.confidence * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </>
  );
};

export default BoundingBoxes;
