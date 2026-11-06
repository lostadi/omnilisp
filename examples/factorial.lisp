; Shared subset: this runs in both the CLI and browser evaluator.
(def factorial
  (lambda (n)
    (if (<= n 1)
      1
      (* n (factorial (- n 1))))))

(print (factorial 6))
