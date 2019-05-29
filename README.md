### js-engine

## 使用
 + 规则定义具体参见 [json-rules-engine](https://github.com/CacheControl/json-rules-engine/blob/master/docs/rules.md),定时器相关的规则参见测试文件`/test/engine.test.js`

## 多进程多节点下的坑
  + 规则/规则对应fact 如果不移除则会在多次`run`时多次触发，建议触发的规则从runtime中移除
  + 定时器是通过提交event方式触发，不会存储到fact，所以不要设置两个有交叉时间的定时器
  + 关于多进程多节点的 定时器/rule同步/fact同步问题
    + 定时器只能在一个进程中运行，否则会一个定时多次触发
    + fact同步可通过配置，是否在每次`run`前同步redis fact缓存
    + rule同步问题，只能在库外做同步方案

## 提升点
  + 在库中加入分布式方案，低消耗解决 rule/fact 同步问题
  + 对runtime中规则 操作时，对应timer操作

## 关于cron
  + 支持两种模式6位和7位
  ```javascript
  *    *    *    *    *    *    *
  ┬    ┬    ┬    ┬    ┬    ┬    ┬
  │    │    │    │    │    │    └ year
  │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
  │    │    │    │    └───── month (1 - 12)
  │    │    │    └────────── day of month (1 - 31)
  │    │    └─────────────── hour (0 - 23)
  │    └──────────────────── minute (0 - 59)
  └───────────────────────── second (0 - 59, OPTIONAL)
  ```