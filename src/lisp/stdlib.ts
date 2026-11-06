export const STANDARD_LIBRARY = `
; OmniLisp Standard Library
; A minimal polyglot foundation

(def map
  (lambda (f lst)
    (if (= (length lst) 0)
        (list)
        (cons (f (car lst)) (map f (cdr lst))))))

(def filter
  (lambda (pred lst)
    (if (= (length lst) 0)
        (list)
        (if (pred (car lst))
            (cons (car lst) (filter pred (cdr lst)))
            (filter pred (cdr lst))))))

(def reduce
  (lambda (f acc lst)
    (if (= (length lst) 0)
        acc
        (reduce f (f acc (car lst)) (cdr lst)))))

; Mock support for evaluating cross-language logic conceptually
(def javascript (lambda (code) (run-js code)))

(def run-c
  (lambda (code)
    (print "Simulating C Compilation and Execution for:" code)
    "Mock C Runtime Output: 0"))

(def run-python
  (lambda (code)
    (print "Simulating Python Execution for:" code)
    "Mock Python Runtime Output: None"))

`;
