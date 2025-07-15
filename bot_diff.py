from math import floor, sqrt

x = int(input("tactics score: "))
y = int(input("strategy score: "))
z = int(input("computation score: "))

print(f"{x}/{y}/{z}")
print(f"{x+y*2}/{z}")
print(f"{floor((x + y*1.5 + 0.5) * sqrt(z) * 10)}")
