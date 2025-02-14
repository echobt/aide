export const content = `# This is an H1
## This is an H2
### This is an H3
#### This is an H4
##### This is an H5

The point of reference-style links is not that they’re easier to write. The point is that with reference-style links, your document source is vastly more readable. Compare the above examples: using reference-style links, the paragraph itself is only 81 characters long; with inline-style links, it’s 176 characters; and as raw \`HTML\`, it’s 234 characters. In the raw \`HTML\`, there’s more markup than there is text.

---

> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
> consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.
> Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.
>
> Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse
> id sem consectetuer libero luctus adipiscing.

---

an example | *an example* | **an example**

---

![](https://gw.alipayobjects.com/zos/kitchen/sLO%24gbrQtp/lobe-chat.webp)

![](https://gw.alipayobjects.com/zos/kitchen/8Ab%24hLJ5ur/cover.webp)

<video
  poster="https://gw.alipayobjects.com/zos/kitchen/sLO%24gbrQtp/lobe-chat.webp"
  src="https://github.com/lobehub/lobe-chat/assets/28616219/f29475a3-f346-4196-a435-41a6373ab9e2"/>

---

1. Bird
1. McHale
1. Parish
    1. Bird
    1. McHale
        1. Parish

---

- Red
- Green
- Blue
    - Red
    - Green
        - Blue

---

This is [an example](http://example.com/ "Title") inline link.

<http://example.com/>


| title | title | title |
| --- | --- | --- |
| content | content | content |


\`\`\`bash
$ pnpm install
\`\`\`


\`\`\`javascript
import { renderHook } from '@testing-library/react-hooks';
import { act } from 'react-dom/test-utils';
import { useDropNodeOnCanvas } from './useDropNodeOnCanvas';
\`\`\`


\`\`\`mermaid
graph TD
A[Enter Chart Definition] --> B(Preview)
B --> C{decide}
C --> D[Keep]
C --> E[Edit Definition]
E --> B
D --> F[Save Image and Code]
F --> B
\`\`\`


---

以下是一段Markdown格式的LaTeX数学公式：

我是一个行内公式：$E=mc^2$

我是一个独立公式：
$$
\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\ldots + x_n
$$

我是一个带有分式的公式：
$$
\\frac{{n!}}{{k!(n-k)!}} = \\binom{n}{k}
$$

我是一个带有上下标的公式：
$$
x^{2} + y^{2} = r^{2}
$$

我是一个带有积分符号的公式：
$$
\\int_{a}^{b} f(x) \\, dx
$$

---

我是一个嵌套测试：
\`\`\`
$1
\`\`\`
`

export const content2 = `# Customize Markdown Components
#### Customize Anchor Behavior
This is [an example](http://example.com/ "Title") inline link.

<http://example.com/>


#### Customize Hr

---

#### Customize Image Display

![](https://gw.alipayobjects.com/zos/kitchen/sLO%24gbrQtp/lobe-chat.webp)
`

export const code = `

#### transformerNotationDiff

\`\`\`ts
export function foo() {
  console.log('hewwo') // [!code --]
  console.log('hello') // [!code ++]
}
\`\`\`

#### transformerNotationHighlight

\`\`\`ts
export function foo() {
  console.log('Highlighted') // [!code highlight]
}
\`\`\`

#### transformerNotationWordHighlight

\`\`\`ts
export function foo() { // [!code word:Hello]
  const msg = 'Hello World'
  console.log(msg) // 打印 Hello World
}
\`\`\`

#### transformerNotationFocus

\`\`\`ts
export function foo() {
  console.log('Focused') // [!code focus]
}
\`\`\`

#### transformerNotationErrorLevel

\`\`\`ts
export function foo() {
  console.error('Error') // [!code error]
  console.warn('Warning') // [!code warning]
}
\`\`\`
`

export const normalCode = `
here is some normal code blocks for chat and composer mode:

\`\`\`typescript:libs/api.ts
startLine: 5
endLine: 20
\`\`\`

\`\`\`typescript:app/page.tsx
console.log('hello')
\`\`\`
`

export const v1ProjectCode = `
here is some code block for v1 ui design mode:

<Thinking>
  To address the user's request, I will create a React Project.
  This component will implement a stopwatch with start, pause, and reset functionality, displaying the elapsed time in a formatted manner.
  I will use multiple files to separate the logic, utility functions, and types for better organization.
</Thinking>

<V1Project id="Stopwatch">

  First, let's create the utility function for formatting time:

  \`\`\`tsx file="src/utils/format-time.ts"
  export function formatTime(time: number): string {
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const milliseconds = Math.floor((time % 1000) / 10);
    return \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}.\${milliseconds.toString().padStart(2, '0')}\`;
  }
  \`\`\`

  Next, let's create the custom hook for the stopwatch logic:

  \`\`\`tsx file="src/hooks/use-stop-watch.ts"
  import { useState, useRef, useCallback } from 'react';

  export function useStopwatch(initialTime: number = 0) {
    const [time, setTime] = useState(initialTime);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const start = useCallback(() => {
      if (!isRunning) {
        setIsRunning(true);
        const startTime = Date.now() - time;
        intervalRef.current = setInterval(() => {
          setTime(Date.now() - startTime);
        }, 10);
      }
    }, [isRunning, time]);

    const pause = useCallback(() => {
      if (isRunning && intervalRef.current) {
        clearInterval(intervalRef.current);
        setIsRunning(false);
      }
    }, [isRunning]);

    const reset = useCallback(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setTime(0);
      setIsRunning(false);
    }, []);

    return { time, isRunning, start, pause, reset };
  }
  \`\`\`

  Now, let's create a types file for our component props:

  \`\`\`tsx file="src/types/stop-watch.ts"
  export interface StopwatchProps {
    initialTime?: number;
  }
  \`\`\`

  Finally, let's create the entry Component for the Stopwatch:

  \`\`\`tsx file="src/components/stop-watch.tsx"
  import { Button } from '@/components/ui/button'
  import { CardContent, Card } from '@/components/ui/card'
  import { useStopwatch } from '../hooks/use-stop-watch'
  import { formatTime } from '../utils/format-time'
  import { StopwatchProps } from '../types/stop-watch'

  export default function Stopwatch({ initialTime = 0 }: StopwatchProps) {
    const { time, isRunning, start, pause, reset } = useStopwatch(initialTime);

    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center gap-4 p-4">
          [tag:div
            className="text-6xl font-bold tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          ]
            {formatTime(time)}
          </div>
          <div className="flex gap-4">
            [tag:Button
              onClick={isRunning ? pause : start}
              aria-pressed={isRunning}
            ]
              {isRunning ? 'Pause' : 'Start'}
            </Button>
            [tag:Button
              onClick={reset}
              disabled={time === 0 && !isRunning}
            ]
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  \`\`\`

</V1Project>


<Thinking>
  The user has asked me for small changes to the onboarding project. I will use <MoveFile> to move the header file to the src directory and <DeleteFile> to remove the sidebar file. I will provide instructions to move the header file and delete the sidebar file. I will make sure to update page.tsx to incorporate the changes.
</Thinking>

Here's the updated code in the email SaaS template:

<V1Project id="Onboarding">

  First I will move the header file to the src directory:

  <MoveFile from="header.tsx" to="src/components/header.tsx" />

  Next, I will delete the sidebar file:

  <DeleteFile file="sidebar.tsx" />

  Finally, let's update the page.tsx to reflect the changes:

  <QuickEdit file="page.tsx">

  // here is the fully updated code

  </QuickEdit>

</V1Project>


I'd be happy to show you how to implement a function that checks if a number is prime. Here's an example implementation along with some test cases:

<Thinking>
  Given the request to implement a simple algorithm, I will use the type="node.js" block to demonstrate the code and its output.
</Thinking>

\`\`\`js type="nodejs" project="Prime Number Checker" file="is-prime.js"
function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;

  if (num % 2 === 0 || num % 3 === 0) return false;

  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }

  return true;
}

// Test cases
console.log(isPrime(2));   // true
console.log(isPrime(17));  // true
console.log(isPrime(4));   // false
console.log(isPrime(27));  // false
console.log(isPrime(97));  // true
\`\`\`

This code defines the \`isPrime\` function and then tests it with several numbers. You can see the results of these tests in the console output. Feel free to modify the test cases or add your own to further explore how the function works!
`

export const totalContent = `${content}

${content2}

${normalCode}

${v1ProjectCode}
`
