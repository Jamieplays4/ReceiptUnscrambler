import { useEffect, useRef, useState } from 'react'
import './App.css'

const ROW_COUNT = 5
const PIECE_COUNT = 10
const OVERLAP = 6

const startingPositions = [
{ x: 8, y: 5, rotation: -4 },
{ x: 55, y: 8, rotation: 3 },

{ x: 10, y: 24, rotation: -3 },
{ x: 53, y: 26, rotation: 4 },

{ x: 7, y: 43, rotation: -5 },
{ x: 55, y: 45, rotation: 2 },

{ x: 12, y: 62, rotation: 3 },
{ x: 52, y: 64, rotation: -4 },

{ x: 8, y: 81, rotation: -2 },
{ x: 54, y: 83, rotation: 4 },
]

/*
These four cuts define the horizontal
boundaries between the five rows.

left/right are percentages of the
receipt height.
*/

const cutDefinitions = [
{ left: 19, right: 25, seed: 1.4 },
{ left: 40, right: 34, seed: 3.1 },
{ left: 61, right: 68, seed: 4.7 },
{ left: 81, right: 74, seed: 6.2 },
]

/*
Create an irregular diagonal tear.
*/

function createTear(left, right, seed) {
const points = []
const segments = 32

for (let i = 0; i <= segments; i++) {
const progress = i / segments

const diagonal =
  left +
  (right - left) * progress

const wave =
  Math.sin(
    progress * Math.PI * 5 + seed
  ) * 0.55

const smallWave =
  Math.sin(
    progress * Math.PI * 13 + seed * 1.7
  ) * 0.22

points.push(
  diagonal + wave + smallWave
)

}

return points
}

function App() {
const [pieces, setPieces] = useState([])
const [selectedPiece, setSelectedPiece] = useState(null)

const interaction = useRef(null)

/*
------------------------------------------
LOAD RECEIPT
------------------------------------------
*/

useEffect(() => {
const image = new Image()

image.src = '/images/froyo_receipt.png'

image.onload = () => {
  /*
    Read the original PNG at its
    native resolution.
  */

  const sourceCanvas =
    document.createElement('canvas')

  sourceCanvas.width = image.naturalWidth
  sourceCanvas.height = image.naturalHeight

  const sourceContext =
    sourceCanvas.getContext('2d', {
      willReadFrequently: true,
    })

  sourceContext.drawImage(
    image,
    0,
    0
  )

  /*
    Find the actual visible receipt
    inside the transparent image.
  */

  const pixels =
    sourceContext.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height
    ).data

  let minX = sourceCanvas.width
  let minY = sourceCanvas.height
  let maxX = 0
  let maxY = 0

  for (
    let y = 0;
    y < sourceCanvas.height;
    y++
  ) {
    for (
      let x = 0;
      x < sourceCanvas.width;
      x++
    ) {
      const alpha =
        pixels[
          (y * sourceCanvas.width + x) * 4 + 3
        ]

      if (alpha > 10) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  /*
    Fallback if the PNG doesn't contain
    detectable transparency.
  */

  if (
    minX > maxX ||
    minY > maxY
  ) {
    minX = 0
    minY = 0
    maxX = sourceCanvas.width - 1
    maxY = sourceCanvas.height - 1
  }

  const receiptWidth =
    maxX - minX + 1

  const receiptHeight =
    maxY - minY + 1

  /*
    Generate the four diagonal tears.
  */

  const tears =
    cutDefinitions.map((cut) =>
      createTear(
        cut.left,
        cut.right,
        cut.seed
      )
    )

  const tearSegments = 32

  /*
    Generate the vertical tear down
    the middle of the receipt.

    It wiggles slightly around 50%.
  */

  const centerTear = []

  for (
    let i = 0;
    i <= tearSegments;
    i++
  ) {
    const progress =
      i / tearSegments

    const wave =
      Math.sin(
        progress * Math.PI * 5 + 1.8
      ) * 0.7

    const smallWave =
      Math.sin(
        progress * Math.PI * 13 + 0.6
      ) * 0.25

    centerTear.push(
      50 + wave + smallWave
    )
  }

  /*
    Convert receipt-height percentage
    into an actual Y coordinate.
  */

  const getY = (percentage) =>
    minY +
    (percentage / 100) *
      receiptHeight

  /*
    Convert receipt-width percentage
    into an actual X coordinate.
  */

  const getX = (percentage) =>
    minX +
    (percentage / 100) *
      receiptWidth

  const generatedPieces = []

  /*
    --------------------------------------
    CREATE 5 ROWS
    --------------------------------------
  */

  for (
    let row = 0;
    row < ROW_COUNT;
    row++
  ) {
    /*
      Top boundary.
    */

    const topBoundary =
      row === 0
        ? Array.from(
            { length: tearSegments + 1 },
            () => minY
          )
        : tears[row - 1].map(getY)

    /*
      Bottom boundary.
    */

    const bottomBoundary =
      row === ROW_COUNT - 1
        ? Array.from(
            { length: tearSegments + 1 },
            () => maxY + 1
          )
        : tears[row].map(getY)

    /*
      Find vertical limits for this row.
    */

    const allY = [
      ...topBoundary,
      ...bottomBoundary,
    ]

    const rowTop =
      Math.min(...allY)

    const rowBottom =
      Math.max(...allY)

    const cropTop =
      Math.max(
        minY,
        Math.floor(
          rowTop - OVERLAP
        )
      )

    const cropBottom =
      Math.min(
        maxY + 1,
        Math.ceil(
          rowBottom + OVERLAP
        )
      )

    const cropHeight =
      cropBottom - cropTop

    /*
      ------------------------------------
      CREATE LEFT + RIGHT PIECES
      ------------------------------------
    */

    for (
      let side = 0;
      side < 2;
      side++
    ) {
      /*
        Find center tear bounds.
      */

      const centerX =
        centerTear.map(getX)

      const centerMinX =
        Math.min(...centerX)

      const centerMaxX =
        Math.max(...centerX)

      /*
        Give both halves 6px of overlap.
      */

      let cropLeft
      let cropRight

      if (side === 0) {
        cropLeft = minX

        cropRight =
          centerMaxX + OVERLAP
      } else {
        cropLeft =
          centerMinX - OVERLAP

        cropRight =
          maxX + 1
      }

      cropLeft =
        Math.max(
          minX,
          cropLeft
        )

      cropRight =
        Math.min(
          maxX + 1,
          cropRight
        )

      const pieceWidth =
        cropRight - cropLeft

      /*
        Create piece canvas.
      */

      const pieceCanvas =
        document.createElement('canvas')

      pieceCanvas.width =
        Math.round(pieceWidth)

      pieceCanvas.height =
        Math.round(cropHeight)

      const pieceContext =
        pieceCanvas.getContext('2d')

      /*
        Draw directly from the original
        receipt image.

        No stretching.
      */

      pieceContext.drawImage(
        image,

        cropLeft,
        cropTop,
        pieceWidth,
        cropHeight,

        0,
        0,
        pieceWidth,
        cropHeight
      )

      /*
        Create clipping path.

        This defines the complete shape
        of this piece.
      */

      pieceContext.globalCompositeOperation =
        'destination-in'

      pieceContext.beginPath()

      /*
        TOP EDGE

        For the left piece, the top edge
        travels from the outer left edge
        to the center tear.

        For the right piece, it travels
        from the center tear to the
        outer right edge.
      */

      if (side === 0) {
        pieceContext.moveTo(
          0,
          topBoundary[0] - cropTop
        )

        for (
          let i = 0;
          i <= tearSegments;
          i++
        ) {
          const x =
            centerX[i] -
            cropLeft

          const y =
            topBoundary[i] -
            cropTop

          pieceContext.lineTo(
            x,
            y
          )
        }

        pieceContext.lineTo(
          pieceWidth,
          topBoundary[
            tearSegments
          ] - cropTop
        )
      } else {
        pieceContext.moveTo(
          centerX[0] -
            cropLeft,
          topBoundary[0] -
            cropTop
        )

        for (
          let i = 0;
          i <= tearSegments;
          i++
        ) {
          const x =
            centerX[i] -
            cropLeft

          const y =
            topBoundary[i] -
            cropTop

          pieceContext.lineTo(
            x,
            y
          )
        }

        pieceContext.lineTo(
          pieceWidth,
          topBoundary[
            tearSegments
          ] - cropTop
        )
      }

      /*
        RIGHT EDGE
      */

      pieceContext.lineTo(
        pieceWidth,
        bottomBoundary[
          tearSegments
        ] - cropTop
      )

      /*
        BOTTOM EDGE
      */

      for (
        let i = tearSegments;
        i >= 0;
        i--
      ) {
        const x =
          side === 0
            ? centerX[i] - cropLeft
            : centerX[i] - cropLeft

        const y =
          bottomBoundary[i] -
          cropTop

        pieceContext.lineTo(
          x,
          y
        )
      }

      /*
        LEFT EDGE
      */

      pieceContext.lineTo(
        0,
        bottomBoundary[0] -
          cropTop
      )

      pieceContext.closePath()

      pieceContext.fill()

      pieceContext.globalCompositeOperation =
        'source-over'

      /*
        Store the piece.
      */

      const pieceIndex =
        row * 2 + side

      generatedPieces.push({
        ...startingPositions[
          pieceIndex
        ],

        id:
          pieceIndex + 1,

        image:
          pieceCanvas.toDataURL(
            'image/png'
          ),

        width:
          pieceCanvas.width,

        height:
          pieceCanvas.height,
      })
    }
  }

  setPieces(
    generatedPieces
  )
}

image.onerror = () => {
  console.error(
    'Could not load /images/froyo_receipt.png'
  )
}

}, [])

/*
------------------------------------------
UPDATE PIECE
------------------------------------------
*/

const updatePiece = (
id,
changes
) => {
setPieces((current) =>
current.map((piece) =>
piece.id === id
? {
...piece,
...changes,
}
: piece
)
)
}

/*
------------------------------------------
START DRAG
------------------------------------------
*/

const startDrag = (
event,
id
) => {
event.preventDefault()
event.stopPropagation()

const field =
  event.currentTarget.parentElement

const fieldRect =
  field.getBoundingClientRect()

const piece =
  pieces.find(
    (item) =>
      item.id === id
  )

if (!piece) return

interaction.current = {
  type: 'drag',
  id,
  fieldRect,

  offsetX:
    event.clientX -
    (
      fieldRect.left +
      (
        piece.x / 100
      ) *
        fieldRect.width
    ),

  offsetY:
    event.clientY -
    (
      fieldRect.top +
      (
        piece.y / 100
      ) *
        fieldRect.height
    ),
}

setSelectedPiece(id)

}

/*
------------------------------------------
START ROTATION
------------------------------------------
*/

const startRotate = (
event,
id
) => {
event.preventDefault()
event.stopPropagation()

const pieceElement =
  event.currentTarget.parentElement

const rect =
  pieceElement.getBoundingClientRect()

const centerX =
  rect.left +
  rect.width / 2

const centerY =
  rect.top +
  rect.height / 2

const startAngle =
  Math.atan2(
    event.clientY - centerY,
    event.clientX - centerX
  ) *
  (180 / Math.PI)

const piece =
  pieces.find(
    (item) =>
      item.id === id
  )

if (!piece) return

interaction.current = {
  type: 'rotate',
  id,
  centerX,
  centerY,
  startAngle,
  startRotation:
    piece.rotation,
}

setSelectedPiece(id)

}

/*
------------------------------------------
POINTER MOVEMENT
------------------------------------------
*/

const moveInteraction = (
event
) => {
const action =
interaction.current

if (!action) return

if (
  action.type === 'drag'
) {
  const x =
    (
      (
        event.clientX -
        action.fieldRect.left -
        action.offsetX
      ) /
      action.fieldRect.width
    ) *
    100

  const y =
    (
      (
        event.clientY -
        action.fieldRect.top -
        action.offsetY
      ) /
      action.fieldRect.height
    ) *
    100

  updatePiece(
    action.id,
    {
      x,
      y,
    }
  )
}

if (
  action.type === 'rotate'
) {
  const currentAngle =
    Math.atan2(
      event.clientY -
        action.centerY,
      event.clientX -
        action.centerX
    ) *
    (180 / Math.PI)

  updatePiece(
    action.id,
    {
      rotation:
        action.startRotation +
        currentAngle -
        action.startAngle,
    }
  )
}

}

/*
------------------------------------------
END INTERACTION
------------------------------------------
*/

const endInteraction = () => {
interaction.current =
null
}

/*
------------------------------------------
RENDER
------------------------------------------
*/

return ( <main className="game">

  <header className="game-header">

    <span>
      221B / EVIDENCE
    </span>

    <span>
      RECEIPT / 001
    </span>

  </header>

  <section className="intro">

    <p className="eyebrow">
      DOCUMENT RECONSTRUCTION
    </p>

    <h1>
      UNSCRAMBLE
      <br />
      <em>
        THE RECEIPT.
      </em>
    </h1>

    <p className="instructions">
      The document has been
      torn apart. Reconstruct
      the receipt to reveal
      the evidence.
    </p>

  </section>

  <section className="puzzle">

    <div className="puzzle-label">

      <span>
        FRAGMENTS
      </span>

      <span>
        {PIECE_COUNT} PIECES
      </span>

    </div>

    <div
      className="piece-field"
      onPointerMove={
        moveInteraction
      }
      onPointerUp={
        endInteraction
      }
      onPointerCancel={
        endInteraction
      }
    >

      {pieces.map(
        (piece) => (

          <div
            key={piece.id}

            className={
              `receipt-piece ${
                selectedPiece ===
                piece.id
                  ? 'selected'
                  : ''
              }`
            }

            style={{
              left:
                `${piece.x}%`,

              top:
                `${piece.y}%`,

              transform:
                `rotate(${piece.rotation}deg)`,

              width:
                'min(44vw, 220px)',

              aspectRatio:
                `${piece.width} / ${piece.height}`,
            }}

            onPointerDown={
              (event) =>
                startDrag(
                  event,
                  piece.id
                )
            }
          >

            <img
              className="receipt-piece-image"

              src={
                piece.image
              }

              alt=""

              draggable="false"
            />

            {selectedPiece ===
              piece.id && (

              <button
                className="rotate-handle"

                aria-label=
                  "Rotate receipt piece"

                onPointerDown={
                  (event) =>
                    startRotate(
                      event,
                      piece.id
                    )
                }
              >
                ↻
              </button>

            )}

          </div>

        )
      )}

    </div>

  </section>

  <footer className="game-footer">

    <span>
      CASE / 221B
    </span>

    <span>
      RECONSTRUCTION REQUIRED
    </span>

  </footer>

</main>

)
}

export default App
