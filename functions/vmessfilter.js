const fly = require("flyio");
const atob = require('atob');
const btoa = require('btoa');
const isUrl = require('is-url');
const URLSafeBase64 = require('urlsafe-base64');

exports.handler = function (event, context, callback) {
  const {
    queryStringParameters
  } = event;

  const url = queryStringParameters['src'];
  const remove = queryStringParameters['remove']; //正则
  const filter = queryStringParameters['filter']; //正则
  const preview = queryStringParameters['preview']; //任意值,有值就预览

  if (!isUrl(url)) {
    return callback(null, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      },
      statusCode: 400,
      body: "参数 src 无效，请检查是否提供了正确的节点订阅地址。"
    });
  }

  fly.get(url).then(response => {
    try {
      const bodyDecoded = atob(response.data);
      const links = bodyDecoded.split('\n');
      //#region 支持协议过滤
      const filteredLinks = links.filter(link => {
        // Only support ssr now
        if (link.startsWith('vmess://')) return true;
        return false;
      });
      if (filteredLinks.length == 0) {
        return callback(null, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          },
          statusCode: 400,
          body: "订阅地址中没有节点信息。"
        });
      }
      //#endregion

      //#region 协议具体内容获取
      const vmessInfos = new Array();
      const vmessLinks = new Array();
      filteredLinks.forEach(link => {
        try {
          let encodedStr = link.replace(/vmess:\/\//, "");
          const decodedStr = URLSafeBase64.decode(encodedStr).toString();
          const vmessObj = JSON.parse(decodedStr)
        //   if (vmessObj.add && vmessObj.port) {
        //     vmessObj.ps = URLSafeBase64.decode(vmessObj.ps).toString();
        //   }
          //#region 协议根据名称进行过滤

          if (filter && filter != "" && !new RegExp(filter).test(vmessObj.ps)) {
            return true;
          }
          if (remove && remove != "" && new RegExp(remove).test(vmessObj.ps)) {
            return true;
          }

          //#endregion
          vmessLinks.push(link);
          vmessInfos.push(vmessObj);
        } catch (e) {}
      });
      if (vmessInfos.length == 0) {
        return callback(null, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          },
          statusCode: 400,
          body: "订阅节点全部解析失败"
        });
      }
      //#endregion
      //#region 结果拼接
      if (preview) {
        return callback(null, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          },
          statusCode: 200,
          body: JSON.stringify({
            vmessInfos,
            vmessLinks
          })
        });
      } else {

        return callback(null, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          },
          statusCode: 200,
          body: btoa(vmessLinks.join('\n'))
        });
      }
      //#endregion
    } catch (e) {
      return callback(null, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        },
        statusCode: 500,
        body: "Runtime Error.\n" + JSON.stringify(e)
      });
    }
  }).catch(error => {
    // 404
    if (error && !isNaN(error.status)) {
      return callback(null, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        },
        statusCode: 400,
        body: "订阅地址网站出现了一个 " + String(error.status) + " 错误。"
      });
    }

    // Unknown
    return callback(null, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      },
      statusCode: 500,
      body: "Unexpected Error.\n" + JSON.stringify(error)
    });
  })

}
