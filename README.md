# 四球追分

Two-player hotseat Chinese four-ball on a dimensionally locked 9-foot table. One machine, mouse or touch. Vite, TypeScript, and Three.js.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123). The dev server binds `0.0.0.0:43123`.

`npm run measure` checks the scoring cases and prints how far a full-power center stun rolls.

## Table

Scene units are meters, Y up.

| Piece | Size |
| --- | --- |
| Playing surface | 2.540 m × 1.270 m |
| Ball | 57.15 mm diameter |
| Cushion nose above the cloth | 36.3 mm |
| Playing surface above the floor | 0.762 m |
| Slate | 25 mm, three pieces, hairline seams |
| Outer cabinet | 2.90 m × 1.63 m (rail width 0.180 m) |
| Corner pocket mouth | 117 mm |
| Side pocket mouth | 130 mm |

Rails and cabinet are white oak. Pockets are gray-white cowhide. A three-shade lamp hangs over the table. Default cloth is tournament green `#127a3e`. Change it during a game with the swatches or the color input: 比赛绿, 电蓝, 酒红, 灰呢.

## How to play

东泽 breaks. 日峰 is the other player. Move the pointer to aim. The cue-ball diagram sets the hit point: high is follow (高杆), low is draw (缩杆), offset is sidespin (塞), center is stun (斯登). Hold to charge the power bar. It fills, then falls. Release to shoot. A tiny charge cancels. Right-drag orbits the camera.

Only balls 1, 2, 3, and 9 are on the table, plus the cue ball. The 1 sits on the foot spot, the 9 touches it, and 2 and 3 sit on the sides. Hit the lowest ball still up (1, then 2, then 3, then 9). Scores add up across racks.

- 犯规, 1 point to the opponent, and ball-in-hand anywhere. The rack continues. A miss, the wrong ball first, a cue ball in the pocket, or a ball off the table is a foul. A scratched break is a foul, not 黄金九. If the 9 falls on a foul it is spotted, not a win. Other balls that were pocketed stay down. Balls that leave the table are spotted.
- 黄金九, 4 points. The breaker pockets the 9 on the break with no foul, including a combination.
- 大金, 10 points. The break pockets at least one object ball and not the 9, then the breaker clears the rest in that visit and the cue ball pockets the 9.
- 小金, 7 points. The break pockets nothing, then a player pockets 1, 2, 3, and 9 in one visit and the cue ball pockets the 9.
- 普胜, 4 points. Any other legal 9. Also a combination 9 that is not 黄金九. If the 9 is pocketed by a combination while ball-in-hand, the shooter loses the rack and the opponent scores 普胜 4.
- 让杆. Offered when both extreme edges of the legal ball are blocked. Passing is not allowed in ball-in-hand. If the receiver then runs out, the score doubles: 普胜 8, 小金 14, 大金 20. A foul by the receiver is still 1 point and ball-in-hand for the passer.

After a rack a flat screen shows the result. The winner's side has a cigar. The loser's side has a revolver with 3 live chambers out of 6. A dry click reads 空枪 and that loser breaks the next rack. A live round reads 实弹 and ends the match on that same screen. 大金 and 小金 flash a full-screen banner first. 再来一局 starts over.

## Roll distance

A full-power straight center-ball shot along the long center line, cue ball starting just off one short cushion, travels **9.33 m**, which is **3.67 playing-surface lengths**, before it stops.
