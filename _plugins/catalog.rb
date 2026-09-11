require "digest"
require "json"

module ICorpi
  class Catalog < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      assets = site.data["generated_assets"]
      raise "Run ./scripts/site build or scripts/prepare_assets.py before Jekyll." unless assets

      site.data["models"].each do |model|
        model["assets"] = assets.fetch(model["id"])
        page = Jekyll::PageWithoutAFile.new(site, site.source, "archive/#{model['id']}", "index.html")
        page.content = ""
        page.data = {
          "layout" => "record", "title" => model["name"], "description" => model["tagline"],
          "nav" => "archive", "model" => model, "model_data" => true,
          "image" => model.dig("assets", "images", "800") || model["image"],
          "scripts" => ["/assets/js/archive.js", "/assets/js/viewer-panel.js", "/assets/js/record-view.js"]
        }
        site.pages << page
      end

      source_files = %w[_config.yml]
      source_files += Dir.chdir(site.source) {
        Dir.glob("{_data,_layouts,_includes,_plugins,assets}/**/*").select { |p| File.file?(p) }
      }
      source_files += Dir.chdir(site.source) { Dir.glob("*.html") }
      digest = Digest::SHA256.new
      digest.update(site.baseurl.to_s)
      source_files.sort.each do |path|
        digest.update(path).update(File.binread(File.join(site.source, path)))
      end
      site.config["build_id"] = digest.hexdigest[0, 20]
      info = Jekyll::PageWithoutAFile.new(site, site.source, "", "build-info.json")
      info.content = JSON.generate({
        "buildId" => site.config["build_id"], "revision" => ENV["GITHUB_SHA"],
        "baseurl" => site.baseurl, "records" => site.data["models"].length
      })
      info.data = { "layout" => nil, "sitemap" => false }
      site.pages << info
    end
  end
end
