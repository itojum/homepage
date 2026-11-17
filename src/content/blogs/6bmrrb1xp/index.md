---
title: "メタプログラミングRuby 4章 〜ブロック〜"
description: "『メタプログラミングRuby』4章のブロックについてまとめた備忘録。スコープゲートやフラットスコープ、instance_eval、Procとlambdaの違いなどをコード例とともに分かりやすく解説します。"
publishedAt: 2026-06-21T07:31:18.571Z
updatedAt: 2026-06-21T07:33:47.454Z
eyecatch: "./eyecatch.png"
category: "技術"
tags: ["Ruby", "備忘録"]
---

こんにちは。いとじゅんと申しまする。

やっとメタプログラミングRubyを再開したので、まとめてみました。

[](https://www.oreilly.co.jp//books/9784873117430/)

<script async="" src="https://iframely.net/embed.js" charset="utf-8"></script>

## ブロックさん

ブロックさんは波括弧または `do...end`キーワードで定義できる。ブロックはメソッド呼び出し時にだけ定義できる。

```ruby
# これはできない
do
  "hoge"
end

# これはいける
hoge_method do
  "hoge"
end
```

メソッドに渡されたブロックは、メソッド内部でyieldキーワードによって、任意のタイミングで実行できる。yieldの意味がやっと理解できた気がする。

```ruby
def sunny
  puts "今から晴れるよ"
  yield("快晴")
end

sunny do |word|
  puts "今日の天気は...#{word}!"
end
# 今から晴れるよ
# 今日の天気は...快晴！
```

ブロックを定義した時、参照した変数などの束縛を持っていくため、クロージャと言える。クロージャってなんですか。

> 自分で作られたスコープの環境を記憶して持ち運べる処理の塊 by Gemini

ほへ〜。意識せずに使っていた。

### スコープ

Rubyのスコープは、下位のスコープから上位のスコープの変数などに参照することができない。トップレベルなどに定義した変数は、下位に定義されたクラスやメソッドなどで参照できない。

```ruby
look_me = "loooooook me!!!"

def fuga
  p look_me
end

fuga # raise NameError
```

### スコープゲート

`def`, `class`, `module`キーワードはスコープを切り替えて、新しいスコープを生成する。これらのキーワードは先ほど書いたスコープの性質によって、上位スコープへのアクセスが不可となる。

スコープゲートから逃れるためには、スコープゲートのキーワードを使わずに、メソッドやクラス、モジュールを定義すれば良い。

```ruby
look_me = "loooooook me!!!"

define_method :fuga do
  p look_me
end

fuga # => "loooooook me!!!"
```

クラスなら`Class.new`, モジュールなら`Module.new`で行ける。このような、スコープを均して上位スコープに参照する方法を**フラットスコープ**と呼ぶ。

## #instance\_eval

`BasicObject#instance_eval`に渡したブロック内では、レシーバをselfにして評価される。よって、そのオブジェクトの束縛にアクセスできるようになる。これ何に使うんだろうと思ったら、デバッグとかテストで使うことがあるそう。なるほどね。ここで渡されたブロックのことを**コンテキスト探査機**と呼ぶ。強そう。

```ruby
class Hoge
  def initialize
    @fuga = "piyo"
  end
end

Hoge.new.instance_eval do
  self 	# => #<Hoge:0x130e9d98 @fuga="piyo">
  @fuga # => "piyo"
end
```

また、オブジェクトの束縛へアクセスできるため、カプセル化が破壊される。ひえ〜。

```ruby
class Hoge
  private
  def private_method
    "いやーん、プライベートよー"
  end
end

Hoge.new.instance_eval do
  private_method # => "いやーん、プライベートよー"
end
```

### クリーンルーム

よくわからなかった。上位スコープに定義された束縛から隔離するために使う？また今度聞く。

## 呼び出し可能オブジェクト

Rubyにはブロック以外にコードを保管して後から呼び出せる場所が少なくとも以下の3つがある。

- Procオブジェクト
- lambda(Procのオブジェクトではあるが、微妙に違う)
- メソッド

ちなみに、ただのブロックはオブジェクトではない。

### Procオブジェクト

先ほど言った通り、ただのブロックはオブジェクトではないが、これだとコードを保管して後から呼び出す時に困る。そこで現れた救世主こそ、Procだ！！！！！これはブロックをオブジェクトにしたもの。

以下のように定義して実行できる。`Proc.new`で定義、`Proc#call`で呼び出すことができる。

```ruby
yaoyoro = Proc.new {|user|
  "#{user}のみんなー！ヤオヨロー！"
  }

yaoyoro.call("神々") # => "神々のみんなー！ヤオヨロー！"
yaoyoro.class	# => Proc
```

lambdaはProcのオブジェクトだが、いろいろ違う。まずは以下のように定義できる。

```ruby
kaguya = lambda { "かぐやっほー！" }

kaguya.call() # => "かぐやっほー！"
kaguya.class	# => Proc
```

lambdaと他のProcの大きな違いは2つある。

1つ目にreturnの挙動が異なる。lambda内のreturnは単にlambdaから返るだけだが、Proc内のreturnはProcが定義されたスコープから返る。みた方が早いと思う。

```ruby
# 通常のProcの場合
def kaguya_hello
  kaguya = Proc.new { return "かぐやっほー！" } # ここのreturnでもう返っちゃう
  result = kaguya.call
  return result * 2 # ここまで来ない！
end

# lambdaの場合
def yachiyo_hello
  yachiyo = lambda { return "ヤオヨロー！" }
  result = yachiyo.call
  return result * 2 # ここで返される
end

kaguya_hello # => "かぐやっほー！"
yachiyo_hello # => "ヤオヨロー！ヤオヨロー！"
```

2つ目の違いは引数のチェック方法。Procは引数の数が多くても少なくても、 `ArgmentError`を返さない。柔軟すぎるかもね。それに対して、 lambdaは引数の数に厳格。

```ruby
p = Proc.new { |a, b| [a, b] }
p.call(1) # => [1, nil]

p = lambda { |a, b| [a, b] }
p.call(1) # => raise ArgumentError
```

lambdaの方が通常のメソッドに近いと覚えておいたら良い。

#### &修飾

`yield`を使うことでメソッド内でブロックに与えた処理を実行できるが、 `yield`じゃ足りないケースがある。例えば、他のメソッドにブロックを渡したいときやブロックをProcに変換したいときなど。

`&修飾`を使うことでメソッドに与えたブロックを束縛し、引数として受け取ることができる。逆にProcに対して `&修飾`を付加してメソッドに与えると、ブロックに戻すことができる。

```ruby
def hello(word, num)
  yield(word, num)
end

def do_hello(word, num, &block) # 引数としてブロックをProcに変換して受け取っている
  block.class # => Proc
  hello(word, num, &block) # Procに対して&を使ってブロックに戻して#helloを呼び出している
end

do_hello("かぐやっほー！", 3) {|word, num| word * num } # => かぐやっほー！かぐやっほー！かぐやっほー！
```

### Methodオブジェクト

以下のコードのようにオブジェクトに対して、 `#method`を使うことでMethodオブジェクトとして取得できる。これは `Method#call`を使うことで実行できる。

```ruby
class CPK
  def initialize(value)
    @x = value
  end

  def hello
    @x
  end
end

object = CPK.new("かぐやっほー")
method = object.method :hello # => #<Method: CPK#hello() eval:6>
method.call # => "かぐやっほー"
```

Procなどとの違う点として評価されるスコープが異なる点がある。`Proc`は定義された時のスコープで評価されるが、`Method`は所属するオブジェクトのスコープで評価される。

#### UnboundMethod

クラスやモジュールから引き離したメソッドは `UnboundMethod`クラスのオブジェクトになる。呼び出し不可だが、 `#bind`を使うことでオブジェクトへ束縛でき、呼び出せるようになる。ただし、メソッドの元々の束縛先がクラスの場合は元のクラスまたはそのサブクラスにしか束縛できない。モジュールの場合は特に制限はない。

```ruby
class CPK
  def initialize(value)
    @x = value
  end

  def hello
    @x
  end
end

object = CPK.instance_method(:hello)
object.class # => UnboundMethod
```

ActiveSupportなどで使われているらしいが、正直どこで使うべきか理解していないのでこれは宿題です。

## おわりに

ここまでやった私は以下のリポジトリの演習問題をやることで、理解したような気がしています。私と同じようにメタプログラミングを学んでいる同志におすすめです。

[](https://github.com/kinoppyd/reading-metaprogramming-ruby)

<script async="" src="https://iframely.net/embed.js" charset="utf-8"></script>

この章を通して、Rubyのスコープやブロックの取り扱い方を学べました。スコープゲート周りとかはメタプログラミング関係なく覚えておくと業務に役立ちそうですね。

ではまたー！
