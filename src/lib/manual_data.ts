import { Question } from './types';

export const manualQuestions: Question[] = [
  {
    id: 'g394b9c360cc8b43a98c752eaff56e61b',
    title: 'Projectile motion Question',
    type: 'multiple-choice',
    prompt: `<div><p>A bullet is aimed at a target on the wall a distance <i>L</i> away from the firing position.&nbsp; Because of gravity, the bullet strikes the wall a distance Δ<i>y</i> below the mark as suggested in the figure.&nbsp; Note: The drawing is not to scale.&nbsp; If the distance <i>L</i> was half as large, and the bullet had the same initial velocity, how would Δ<i>y</i> be affected?</p>
<p>[Image: Projectile Motion Diagram]</p></div>`,
    points: 1.0,
    options: [
      {
        id: '746',
        text: 'Δy will be one fourth as large.',
        isCorrect: true
      },
      {
        id: '872',
        text: 'Δy will be half as large.',
        isCorrect: false
      },
      {
        id: '2840',
        text: 'Δy will double.',
        isCorrect: false
      },
      {
        id: '2794',
        text: 'Δy will be four times larger.',
        isCorrect: false
      }
    ]
  }
];
