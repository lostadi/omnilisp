; A closure retains the environment in which it was created.
(def make-adder (lambda (x) (lambda (y) (+ x y))))
(def add-seven (make-adder 7))
(print (add-seven 35))
